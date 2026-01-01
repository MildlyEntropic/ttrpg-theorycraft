import { getDb, jsonStringify } from '../../../data/db.js';
import { SYSTEM_ID } from './sources.js';

const WIKIDOT_BASE = 'https://dnd5e.wikidot.com';
const RATE_LIMIT_MS = 500;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchPage(path) {
  const url = `${WIKIDOT_BASE}${path}`;
  console.log(`Fetching: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

// Parse a feat page
function parseFeatPage(html, featName) {
  const feat = {
    name: featName,
    prerequisite: null,
    abilityScoreIncrease: null,
    description: null,
    benefits: [],
    source: null
  };

  // Source - look for "Source:" text
  const sourceMatch = html.match(/Source:?\s*([^<\n]+)/i);
  if (sourceMatch) {
    feat.source = sourceMatch[1].trim();
  } else {
    feat.source = "Player's Handbook";
  }

  // Prerequisite - look for "Prerequisite:" text
  const prereqMatch = html.match(/Prerequisite:?\s*([^<\n]+)/i);
  if (prereqMatch) {
    feat.prerequisite = prereqMatch[1].trim();
  }

  // Look for ability score increase pattern
  // "Increase your X score by 1" or "Increase your X, Y, or Z by 1"
  const asiMatch = html.match(/Increase your ([^.]+) (?:score )?by 1/i);
  if (asiMatch) {
    feat.abilityScoreIncrease = asiMatch[1].trim();
  }

  // Extract benefits from list items
  const listItems = html.match(/<li>([^<]+)<\/li>/g);
  if (listItems) {
    feat.benefits = listItems.map(item =>
      item.replace(/<\/?li>/g, '').trim()
    ).filter(item => item.length > 0);
  }

  // Get full description - everything in the main content area
  const descParts = [];
  const paragraphs = html.match(/<p>([^]*?)<\/p>/g);
  if (paragraphs) {
    for (const p of paragraphs) {
      const text = p.replace(/<[^>]+>/g, '').trim();
      // Skip source/prereq lines and very short text
      if (text.length > 20 &&
          !text.toLowerCase().startsWith('source:') &&
          !text.toLowerCase().startsWith('prerequisite:')) {
        descParts.push(text);
      }
    }
  }

  // Also check for bullet list items as part of description
  if (feat.benefits.length > 0) {
    descParts.push(...feat.benefits);
  }

  feat.description = descParts.join(' ').trim();

  return feat;
}

// Get all feat links from the homepage
async function getFeatList() {
  const html = await fetchPage('/');

  // Extract all feat links: /feat:feat-name
  const linkPattern = /href="\/feat:([^"]+)"/g;
  const feats = new Set();

  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    feats.add(match[1]);
  }

  return Array.from(feats).sort();
}

// Scrape a single feat
async function scrapeFeat(featSlug) {
  const html = await fetchPage(`/feat:${featSlug}`);

  // Convert slug to name
  const name = featSlug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return parseFeatPage(html, name);
}

// Sync all feats from wikidot
export async function syncWikidotFeats(options = {}) {
  const db = getDb();
  const { limit = null, startFrom = null } = options;

  console.log('Fetching feat list from dnd5e.wikidot.com...');
  let featSlugs = await getFeatList();
  console.log(`Found ${featSlugs.length} feats`);

  if (startFrom) {
    const startIdx = featSlugs.indexOf(startFrom);
    if (startIdx > -1) {
      featSlugs = featSlugs.slice(startIdx);
      console.log(`Resuming from ${startFrom}, ${featSlugs.length} remaining`);
    }
  }

  if (limit) {
    featSlugs = featSlugs.slice(0, limit);
    console.log(`Limited to ${limit} feats for testing`);
  }

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO dnd5e_feats (
      key, name, prerequisite, description, benefits, source, raw_data
    ) VALUES (
      @key, @name, @prerequisite, @description, @benefits, @source, @raw_data
    )
  `);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < featSlugs.length; i++) {
    const slug = featSlugs[i];

    try {
      console.log(`[${i + 1}/${featSlugs.length}] Scraping: ${slug}`);
      const feat = await scrapeFeat(slug);

      insertStmt.run({
        key: `wikidot_${slug}`,
        name: feat.name,
        prerequisite: feat.prerequisite,
        description: feat.description,
        benefits: jsonStringify(feat.benefits),
        source: feat.source,
        raw_data: jsonStringify(feat)
      });

      successCount++;
    } catch (err) {
      console.error(`Error scraping ${slug}:`, err.message);
      errors.push({ slug, error: err.message });
      errorCount++;
    }

    await delay(RATE_LIMIT_MS);
  }

  db.prepare(`
    INSERT OR REPLACE INTO sync_status (system_id, resource_type, last_synced, item_count)
    VALUES (?, 'wikidot_feats', datetime('now'), ?)
  `).run(SYSTEM_ID, successCount);

  console.log(`\nSync complete: ${successCount} feats synced, ${errorCount} errors`);

  return { success: successCount, errors: errorCount, errorList: errors };
}

// Test scraping a single feat
export async function testScrapeFeat(featSlug) {
  return scrapeFeat(featSlug);
}

// List all feats from wikidot
export async function listWikidotFeats() {
  return getFeatList();
}
