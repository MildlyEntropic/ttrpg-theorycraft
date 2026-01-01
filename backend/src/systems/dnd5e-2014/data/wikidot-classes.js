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

// Base classes
const BASE_CLASSES = [
  'artificer', 'barbarian', 'bard', 'cleric', 'druid',
  'fighter', 'monk', 'paladin', 'ranger', 'rogue',
  'sorcerer', 'warlock', 'wizard'
];

// Parse hit die
function parseHitDie(html) {
  const match = html.match(/Hit Dice:?\s*(?:1)?d(\d+)/i) ||
                html.match(/(\d+)d(\d+)\s*per\s+\w+\s+level/i);
  if (match) {
    return `d${match[1] || match[2]}`;
  }
  return null;
}

// Parse saving throws
function parseSavingThrows(html) {
  const saves = [];
  const abilities = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];

  const match = html.match(/Saving Throws:?\s*([^<\n]+)/i);
  if (match) {
    const text = match[1];
    for (const ability of abilities) {
      if (text.toLowerCase().includes(ability.toLowerCase())) {
        saves.push(ability);
      }
    }
  }
  return saves;
}

// Parse armor proficiencies
function parseArmorProf(html) {
  const match = html.match(/Armor:?\s*([^<\n]+)/i);
  if (match) {
    return match[1].trim();
  }
  return 'None';
}

// Parse weapon proficiencies
function parseWeaponProf(html) {
  const match = html.match(/Weapons:?\s*([^<\n]+)/i);
  if (match) {
    return match[1].trim();
  }
  return 'None';
}

// Parse skills
function parseSkills(html) {
  const match = html.match(/Skills:?\s*(?:Choose\s+(?:two|three|any\s+\w+)\s+(?:from\s+)?)?([^<\n]+)/i);
  if (match) {
    return match[1].trim();
  }
  return null;
}

// Parse spellcasting ability
function parseSpellcastingAbility(html) {
  const abilities = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
  const match = html.match(/spellcasting ability(?:\s+is)?\s*(\w+)/i);
  if (match) {
    const found = abilities.find(a => a.toLowerCase() === match[1].toLowerCase());
    return found || null;
  }
  return null;
}

// Parse class features
function parseFeatures(html) {
  const features = [];

  // Look for feature headers with level indicators
  const featurePattern = /<strong>([^<]+)<\/strong>/g;
  let match;

  while ((match = featurePattern.exec(html)) !== null) {
    const name = match[1].trim();

    // Skip meta headers
    if (['Source', 'Hit Points', 'Proficiencies', 'Equipment'].some(s =>
      name.toLowerCase().includes(s.toLowerCase())
    )) {
      continue;
    }

    // Try to find level in the name or nearby
    let level = null;
    const levelMatch = name.match(/(?:at\s+)?(\d+)(?:st|nd|rd|th)?\s*(?:level)?/i) ||
                       html.slice(match.index - 50, match.index).match(/level\s*(\d+)/i);
    if (levelMatch) {
      level = parseInt(levelMatch[1]);
    }

    if (name.length > 2) {
      features.push({ name, level });
    }
  }

  return features;
}

// Parse subclass list
function parseSubclasses(html, className) {
  const subclasses = [];

  // Look for subclass links
  const pattern = new RegExp(`href="/${className}:([^"]+)"`, 'g');
  let match;

  while ((match = pattern.exec(html)) !== null) {
    subclasses.push(match[1]);
  }

  return [...new Set(subclasses)].sort();
}

// Parse a class page
function parseClassPage(html, className) {
  const classData = {
    name: className.charAt(0).toUpperCase() + className.slice(1),
    source: null,
    hitDie: null,
    primaryAbility: null,
    savingThrows: [],
    armorProficiencies: null,
    weaponProficiencies: null,
    skills: null,
    spellcastingAbility: null,
    features: [],
    subclasses: [],
    description: null
  };

  // Source
  const sourceMatch = html.match(/Source:?\s*([^<\n]+)/i);
  classData.source = sourceMatch ? sourceMatch[1].trim() : "Player's Handbook";

  // Core stats
  classData.hitDie = parseHitDie(html);
  classData.savingThrows = parseSavingThrows(html);
  classData.armorProficiencies = parseArmorProf(html);
  classData.weaponProficiencies = parseWeaponProf(html);
  classData.skills = parseSkills(html);
  classData.spellcastingAbility = parseSpellcastingAbility(html);

  // Features
  classData.features = parseFeatures(html);

  // Subclasses
  classData.subclasses = parseSubclasses(html, className.toLowerCase());

  // Description - first substantial paragraph
  const descMatch = html.match(/<p>([^<]{50,})/);
  if (descMatch) {
    classData.description = descMatch[1].trim();
  }

  return classData;
}

// Parse a subclass page
function parseSubclassPage(html, className, subclassName) {
  const subclass = {
    name: subclassName,
    className: className,
    source: null,
    features: [],
    description: null
  };

  // Source
  const sourceMatch = html.match(/Source:?\s*([^<\n]+)/i);
  subclass.source = sourceMatch ? sourceMatch[1].trim() : "Player's Handbook";

  // Features
  subclass.features = parseFeatures(html);

  // Description
  const descMatch = html.match(/<p>([^<]{50,})/);
  if (descMatch) {
    subclass.description = descMatch[1].trim();
  }

  return subclass;
}

// Get all class and subclass entries
async function getClassList() {
  const html = await fetchPage('/');

  const entries = [];

  // Add base classes
  for (const cls of BASE_CLASSES) {
    entries.push({ type: 'class', slug: cls, className: cls });
  }

  // Find subclass links
  for (const cls of BASE_CLASSES) {
    const pattern = new RegExp(`href="/${cls}:([^"]+)"`, 'g');
    let match;
    while ((match = pattern.exec(html)) !== null) {
      entries.push({
        type: 'subclass',
        slug: `${cls}:${match[1]}`,
        className: cls,
        subclassSlug: match[1]
      });
    }
  }

  return entries;
}

// Scrape a single class or subclass
async function scrapeClass(entry) {
  if (entry.type === 'class') {
    const html = await fetchPage(`/${entry.slug}`);
    return {
      type: 'class',
      data: parseClassPage(html, entry.className)
    };
  } else {
    const html = await fetchPage(`/${entry.slug}`);
    const subclassName = entry.subclassSlug
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return {
      type: 'subclass',
      data: parseSubclassPage(html, entry.className, subclassName)
    };
  }
}

// Sync all classes from wikidot
export async function syncWikidotClasses(options = {}) {
  const db = getDb();
  const { limit = null, classesOnly = false, subclassesOnly = false } = options;

  console.log('Fetching class list from dnd5e.wikidot.com...');
  let entries = await getClassList();
  console.log(`Found ${entries.length} class/subclass entries`);

  if (classesOnly) {
    entries = entries.filter(e => e.type === 'class');
  }
  if (subclassesOnly) {
    entries = entries.filter(e => e.type === 'subclass');
  }

  if (limit) {
    entries = entries.slice(0, limit);
    console.log(`Limited to ${limit} entries for testing`);
  }

  // Create subclasses table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS dnd5e_subclasses (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      class_key TEXT NOT NULL,
      source TEXT,
      features JSON,
      description TEXT,
      raw_data JSON
    )
  `);

  const insertClassStmt = db.prepare(`
    INSERT OR REPLACE INTO dnd5e_classes (
      key, name, hit_die, primary_ability, saves, proficiencies,
      features, archetypes, spellcasting_ability, source, raw_data
    ) VALUES (
      @key, @name, @hit_die, @primary_ability, @saves, @proficiencies,
      @features, @archetypes, @spellcasting_ability, @source, @raw_data
    )
  `);

  const insertSubclassStmt = db.prepare(`
    INSERT OR REPLACE INTO dnd5e_subclasses (
      key, name, class_key, source, features, description, raw_data
    ) VALUES (
      @key, @name, @class_key, @source, @features, @description, @raw_data
    )
  `);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    try {
      console.log(`[${i + 1}/${entries.length}] Scraping: ${entry.slug}`);
      const result = await scrapeClass(entry);

      if (result.type === 'class') {
        const data = result.data;
        insertClassStmt.run({
          key: `wikidot_${entry.slug}`,
          name: data.name,
          hit_die: data.hitDie,
          primary_ability: data.primaryAbility,
          saves: jsonStringify(data.savingThrows),
          proficiencies: jsonStringify({
            armor: data.armorProficiencies,
            weapons: data.weaponProficiencies,
            skills: data.skills
          }),
          features: jsonStringify(data.features),
          archetypes: jsonStringify(data.subclasses),
          spellcasting_ability: data.spellcastingAbility,
          source: data.source,
          raw_data: jsonStringify(data)
        });
      } else {
        const data = result.data;
        insertSubclassStmt.run({
          key: `wikidot_${entry.slug}`,
          name: data.name,
          class_key: `wikidot_${entry.className}`,
          source: data.source,
          features: jsonStringify(data.features),
          description: data.description,
          raw_data: jsonStringify(data)
        });
      }

      successCount++;
    } catch (err) {
      console.error(`Error scraping ${entry.slug}:`, err.message);
      errors.push({ slug: entry.slug, error: err.message });
      errorCount++;
    }

    await delay(RATE_LIMIT_MS);
  }

  db.prepare(`
    INSERT OR REPLACE INTO sync_status (system_id, resource_type, last_synced, item_count)
    VALUES (?, 'wikidot_classes', datetime('now'), ?)
  `).run(SYSTEM_ID, successCount);

  console.log(`\nSync complete: ${successCount} classes/subclasses synced, ${errorCount} errors`);

  return { success: successCount, errors: errorCount, errorList: errors };
}

// Test scraping a single class
export async function testScrapeClass(classSlug) {
  const entry = classSlug.includes(':')
    ? { type: 'subclass', slug: classSlug, className: classSlug.split(':')[0], subclassSlug: classSlug.split(':')[1] }
    : { type: 'class', slug: classSlug, className: classSlug };
  return scrapeClass(entry);
}

// List all classes from wikidot
export async function listWikidotClasses() {
  return getClassList();
}
