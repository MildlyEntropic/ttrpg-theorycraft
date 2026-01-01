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

// Parse ability score increases
function parseAbilityScores(html) {
  const scores = {};

  // Look for patterns like "Dexterity +2", "Wisdom score increases by 1"
  const patterns = [
    /(\w+)\s*\+(\d+)/gi,
    /(\w+)\s+score\s+increases?\s+by\s+(\d+)/gi,
    /increase\s+(?:your\s+)?(\w+)\s+(?:score\s+)?by\s+(\d+)/gi
  ];

  const abilities = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const ability = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      if (abilities.includes(ability)) {
        scores[ability] = parseInt(match[2]);
      }
    }
  }

  return Object.keys(scores).length > 0 ? scores : null;
}

// Parse speed
function parseSpeed(html) {
  const match = html.match(/Speed\.?\s*(?:Your\s+(?:base\s+)?(?:walking\s+)?speed\s+is\s+)?(\d+)\s*(?:feet|ft)/i);
  return match ? parseInt(match[1]) : 30;
}

// Parse size
function parseSize(html) {
  const match = html.match(/Size\.?\s*(?:Your\s+size\s+is\s+)?(\w+)/i);
  if (match) {
    const size = match[1].toLowerCase();
    if (size.includes('small')) return 'Small';
    if (size.includes('medium')) return 'Medium';
    if (size.includes('large')) return 'Large';
  }
  return 'Medium';
}

// Parse traits from the page
function parseTraits(html) {
  const traits = [];

  // Look for bold/strong trait names followed by descriptions
  const traitPatterns = [
    /<strong>([^<]+)<\/strong>\s*[.:]\s*([^<]+)/g,
    /<b>([^<]+)<\/b>\s*[.:]\s*([^<]+)/g
  ];

  for (const pattern of traitPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const name = match[1].trim();
      const desc = match[2].trim();

      // Skip meta fields
      if (['Source', 'Prerequisite', 'Size', 'Speed', 'Age', 'Alignment', 'Languages'].includes(name)) {
        continue;
      }

      if (name.length > 2 && desc.length > 10) {
        traits.push({ name, description: desc });
      }
    }
  }

  return traits;
}

// Parse subraces
function parseSubraces(html) {
  const subraces = [];

  // Look for subrace headers (usually h3 or h4)
  const subracePattern = /<h[34][^>]*>([^<]+)<\/h[34]>/g;
  let match;
  const headers = [];

  while ((match = subracePattern.exec(html)) !== null) {
    headers.push({
      name: match[1].trim(),
      index: match.index
    });
  }

  // Extract content between headers
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const nextIndex = i < headers.length - 1 ? headers[i + 1].index : html.length;
    const content = html.slice(header.index, nextIndex);

    // Skip if it's a non-subrace header
    if (header.name.toLowerCase().includes('source') ||
        header.name.toLowerCase().includes('trait') ||
        header.name.length < 3) {
      continue;
    }

    const subrace = {
      name: header.name,
      abilityScores: parseAbilityScores(content),
      traits: parseTraits(content)
    };

    if (subrace.abilityScores || subrace.traits.length > 0) {
      subraces.push(subrace);
    }
  }

  return subraces;
}

// Parse a lineage page
function parseLineagePage(html, lineageName) {
  const lineage = {
    name: lineageName,
    source: null,
    abilityScores: null,
    size: 'Medium',
    speed: 30,
    darkvision: null,
    languages: [],
    traits: [],
    subraces: [],
    description: null
  };

  // Source
  const sourceMatch = html.match(/Source:?\s*([^<\n]+)/i);
  if (sourceMatch) {
    lineage.source = sourceMatch[1].trim();
  } else {
    lineage.source = "Player's Handbook";
  }

  // Ability scores
  lineage.abilityScores = parseAbilityScores(html);

  // Size
  lineage.size = parseSize(html);

  // Speed
  lineage.speed = parseSpeed(html);

  // Darkvision
  const darkMatch = html.match(/Darkvision\.?\s*[^.]*?(\d+)\s*(?:feet|ft)/i);
  if (darkMatch) {
    lineage.darkvision = parseInt(darkMatch[1]);
  }

  // Languages
  const langMatch = html.match(/Languages\.?\s*(?:You\s+(?:can\s+)?(?:speak,?\s*)?(?:read,?\s*)?(?:and\s+)?(?:write\s+)?)?([^<.]+)/i);
  if (langMatch) {
    const langText = langMatch[1];
    const commonLangs = ['Common', 'Elvish', 'Dwarvish', 'Giant', 'Gnomish', 'Goblin',
                          'Halfling', 'Orc', 'Abyssal', 'Celestial', 'Draconic',
                          'Deep Speech', 'Infernal', 'Primordial', 'Sylvan', 'Undercommon'];
    lineage.languages = commonLangs.filter(lang =>
      langText.toLowerCase().includes(lang.toLowerCase())
    );
  }

  // Traits
  lineage.traits = parseTraits(html);

  // Subraces
  lineage.subraces = parseSubraces(html);

  // Description - first substantial paragraph
  const descMatch = html.match(/<p>([^<]{50,})/);
  if (descMatch) {
    lineage.description = descMatch[1].trim();
  }

  return lineage;
}

// Get all lineage links from the lineage page
async function getLineageList() {
  const html = await fetchPage('/lineage');

  const linkPattern = /href="\/lineage:([^"]+)"/g;
  const lineages = new Set();

  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    lineages.add(match[1]);
  }

  return Array.from(lineages).sort();
}

// Scrape a single lineage
async function scrapeLineage(lineageSlug) {
  const html = await fetchPage(`/lineage:${lineageSlug}`);

  // Convert slug to name
  const name = lineageSlug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return parseLineagePage(html, name);
}

// Sync all lineages from wikidot
export async function syncWikidotLineages(options = {}) {
  const db = getDb();
  const { limit = null, startFrom = null } = options;

  console.log('Fetching lineage list from dnd5e.wikidot.com...');
  let lineageSlugs = await getLineageList();
  console.log(`Found ${lineageSlugs.length} lineages`);

  if (startFrom) {
    const startIdx = lineageSlugs.indexOf(startFrom);
    if (startIdx > -1) {
      lineageSlugs = lineageSlugs.slice(startIdx);
      console.log(`Resuming from ${startFrom}, ${lineageSlugs.length} remaining`);
    }
  }

  if (limit) {
    lineageSlugs = lineageSlugs.slice(0, limit);
    console.log(`Limited to ${limit} lineages for testing`);
  }

  // Create lineages table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS dnd5e_lineages (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source TEXT,
      ability_scores JSON,
      size TEXT,
      speed INTEGER,
      darkvision INTEGER,
      languages JSON,
      traits JSON,
      subraces JSON,
      description TEXT,
      raw_data JSON
    )
  `);

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO dnd5e_lineages (
      key, name, source, ability_scores, size, speed, darkvision,
      languages, traits, subraces, description, raw_data
    ) VALUES (
      @key, @name, @source, @ability_scores, @size, @speed, @darkvision,
      @languages, @traits, @subraces, @description, @raw_data
    )
  `);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < lineageSlugs.length; i++) {
    const slug = lineageSlugs[i];

    try {
      console.log(`[${i + 1}/${lineageSlugs.length}] Scraping: ${slug}`);
      const lineage = await scrapeLineage(slug);

      insertStmt.run({
        key: `wikidot_${slug}`,
        name: lineage.name,
        source: lineage.source,
        ability_scores: jsonStringify(lineage.abilityScores),
        size: lineage.size,
        speed: lineage.speed,
        darkvision: lineage.darkvision,
        languages: jsonStringify(lineage.languages),
        traits: jsonStringify(lineage.traits),
        subraces: jsonStringify(lineage.subraces),
        description: lineage.description,
        raw_data: jsonStringify(lineage)
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
    VALUES (?, 'wikidot_lineages', datetime('now'), ?)
  `).run(SYSTEM_ID, successCount);

  console.log(`\nSync complete: ${successCount} lineages synced, ${errorCount} errors`);

  return { success: successCount, errors: errorCount, errorList: errors };
}

// Test scraping a single lineage
export async function testScrapeLineage(lineageSlug) {
  return scrapeLineage(lineageSlug);
}

// List all lineages from wikidot
export async function listWikidotLineages() {
  return getLineageList();
}
