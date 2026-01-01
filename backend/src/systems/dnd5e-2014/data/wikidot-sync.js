import { getDb, jsonStringify } from '../../../data/db.js';
import { SYSTEM_ID } from './sources.js';

const WIKIDOT_BASE = 'https://dnd5e.wikidot.com';
const RATE_LIMIT_MS = 500; // Be respectful to the server

// Delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch HTML from wikidot
async function fetchPage(path) {
  const url = `${WIKIDOT_BASE}${path}`;
  console.log(`Fetching: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

// Parse spell level from text like "1st-level evocation" or "Evocation cantrip"
function parseSpellLevel(levelText) {
  if (!levelText) return { level: 0, school: null };

  const text = levelText.toLowerCase().trim();

  // Cantrip pattern: "Evocation cantrip"
  if (text.includes('cantrip')) {
    const school = text.replace('cantrip', '').trim();
    return { level: 0, school: capitalizeFirst(school) };
  }

  // Level pattern: "1st-level evocation"
  const match = text.match(/(\d+)(?:st|nd|rd|th)-level\s+(\w+)/);
  if (match) {
    return {
      level: parseInt(match[1]),
      school: capitalizeFirst(match[2])
    };
  }

  return { level: 0, school: null };
}

function capitalizeFirst(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Parse components from text like "V, S, M (a diamond worth at least 50 gp)"
function parseComponents(componentsText) {
  if (!componentsText) return { verbal: false, somatic: false, material: null };

  const text = componentsText.trim();
  const verbal = text.includes('V');
  const somatic = text.includes('S');

  let material = null;
  const matMatch = text.match(/M\s*\(([^)]+)\)/);
  if (matMatch) {
    material = matMatch[1].trim();
  } else if (text.includes('M')) {
    material = 'material component required';
  }

  return { verbal, somatic, material };
}

// Extract damage roll from description
function extractDamageRoll(description) {
  if (!description) return null;

  // Look for damage patterns like "3d8 damage", "deals 8d6 fire damage"
  const patterns = [
    /(\d+d\d+(?:\s*\+\s*\d+)?)\s+(?:\w+\s+)?damage/i,
    /deals?\s+(\d+d\d+(?:\s*\+\s*\d+)?)/i,
    /takes?\s+(\d+d\d+(?:\s*\+\s*\d+)?)/i,
    /(\d+d\d+)\s+(?:acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)/i
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// Extract damage types from description
function extractDamageTypes(description) {
  if (!description) return [];

  const types = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
                 'necrotic', 'piercing', 'poison', 'psychic', 'radiant',
                 'slashing', 'thunder'];

  const found = [];
  const text = description.toLowerCase();

  for (const type of types) {
    if (text.includes(`${type} damage`)) {
      found.push(type);
    }
  }

  return found;
}

// Extract saving throw from description
function extractSavingThrow(description) {
  if (!description) return null;

  const match = description.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving\s+throw/i);
  return match ? match[1].toLowerCase() : null;
}

// Check if spell requires attack roll
function hasAttackRoll(description) {
  if (!description) return false;

  const text = description.toLowerCase();
  return text.includes('spell attack') ||
         text.includes('ranged spell attack') ||
         text.includes('melee spell attack');
}

// Parse a single spell page HTML using regex (simple HTML parsing)
function parseSpellPage(html, spellName) {
  const spell = {
    name: spellName,
    level: 0,
    school: null,
    castingTime: null,
    range: null,
    components: null,
    duration: null,
    concentration: false,
    ritual: false,
    description: null,
    higherLevel: null,
    classes: [],
    source: null
  };

  // The wikidot pages have a consistent structure with paragraphs
  // Extract the main content area

  // Level and school - usually first line after title
  // Pattern: "1st-level evocation" or "Evocation cantrip"
  const levelMatch = html.match(/(\d+(?:st|nd|rd|th)-level\s+\w+|(?:Abjuration|Conjuration|Divination|Enchantment|Evocation|Illusion|Necromancy|Transmutation)\s+cantrip)/i);
  if (levelMatch) {
    const parsed = parseSpellLevel(levelMatch[1]);
    spell.level = parsed.level;
    spell.school = parsed.school;
  }

  // Casting Time
  const castingMatch = html.match(/Casting Time:?\s*<\/strong>\s*([^<\n]+)/i) ||
                       html.match(/Casting Time:?\s*([^<\n]+)/i);
  if (castingMatch) {
    spell.castingTime = castingMatch[1].trim();
  }

  // Range
  const rangeMatch = html.match(/Range:?\s*<\/strong>\s*([^<\n]+)/i) ||
                     html.match(/Range:?\s*([^<\n]+)/i);
  if (rangeMatch) {
    spell.range = rangeMatch[1].trim();
  }

  // Components
  const componentsMatch = html.match(/Components:?\s*<\/strong>\s*([^<]+)/i) ||
                          html.match(/Components:?\s*([^\n<]+)/i);
  if (componentsMatch) {
    spell.components = componentsMatch[1].trim();
  }

  // Duration
  const durationMatch = html.match(/Duration:?\s*<\/strong>\s*([^<\n]+)/i) ||
                        html.match(/Duration:?\s*([^<\n]+)/i);
  if (durationMatch) {
    const durationText = durationMatch[1].trim();
    spell.duration = durationText;
    spell.concentration = durationText.toLowerCase().includes('concentration');
  }

  // Check for ritual tag
  spell.ritual = html.toLowerCase().includes('ritual') &&
                 (html.includes('(ritual)') || html.match(/can be cast as a ritual/i));

  // Description - this is trickier, need to get the main body text
  // Usually between the stats block and "At Higher Levels" or "Spell Lists"
  const descMatch = html.match(/<p>([^]*?)<\/p>/g);
  if (descMatch) {
    // Filter out stats paragraphs, combine the rest
    const descParts = descMatch
      .map(p => p.replace(/<[^>]+>/g, '').trim())
      .filter(p => {
        const lower = p.toLowerCase();
        return p.length > 20 &&
               !lower.startsWith('casting time') &&
               !lower.startsWith('range') &&
               !lower.startsWith('components') &&
               !lower.startsWith('duration') &&
               !lower.includes('-level') && !lower.includes('cantrip');
      });

    // Find the main description (usually longest paragraph before "At Higher Levels")
    let mainDesc = '';
    let higherLevels = '';
    let foundHigherLevels = false;

    for (const part of descParts) {
      if (part.toLowerCase().includes('at higher levels')) {
        foundHigherLevels = true;
        higherLevels = part.replace(/at higher levels\.?\s*/i, '').trim();
      } else if (part.toLowerCase().includes('spell lists')) {
        // Skip spell lists section
        continue;
      } else if (!foundHigherLevels) {
        mainDesc += (mainDesc ? ' ' : '') + part;
      } else {
        higherLevels += ' ' + part;
      }
    }

    spell.description = mainDesc.trim();
    spell.higherLevel = higherLevels.trim() || null;
  }

  // Classes - look for "Spell Lists" section with linked class names
  // Format: Spell Lists. <a href="...">Sorcerer</a>, <a href="...">Wizard</a>
  const classListMatch = html.match(/Spell Lists\.?[^<]*(<a[^>]*>[^<]+<\/a>(?:\s*,\s*<a[^>]*>[^<]+<\/a>)*)/i);
  if (classListMatch) {
    // Extract class names from the anchor tags
    const classAnchors = classListMatch[1].match(/<a[^>]*>([^<]+)<\/a>/g);
    if (classAnchors) {
      spell.classes = classAnchors.map(a => a.replace(/<[^>]+>/g, '').trim());
    }
  } else {
    // Fallback: look for class names near "Spell Lists"
    const classSection = html.match(/Spell Lists[^]*?(?=<\/p>|$)/i);
    if (classSection) {
      const classNames = ['Artificer', 'Bard', 'Cleric', 'Druid', 'Paladin',
                          'Ranger', 'Sorcerer', 'Warlock', 'Wizard'];
      spell.classes = classNames.filter(c => classSection[0].includes(c));
    }
  }

  // Source - look for source book reference
  const sourceMatch = html.match(/Source:?\s*([^<\n]+)/i);
  if (sourceMatch) {
    spell.source = sourceMatch[1].trim();
  } else {
    // Default to PHB for wikidot spells
    spell.source = "Player's Handbook";
  }

  return spell;
}

// Fetch spell list and extract all spell links
async function getSpellList() {
  const html = await fetchPage('/spells');

  // Extract all spell links: /spell:spell-name
  const linkPattern = /href="\/spell:([^"]+)"/g;
  const spells = new Set();

  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    spells.add(match[1]);
  }

  return Array.from(spells).sort();
}

// Scrape a single spell
async function scrapeSpell(spellSlug) {
  const html = await fetchPage(`/spell:${spellSlug}`);

  // Convert slug to name: "chromatic-orb" -> "Chromatic Orb"
  const name = spellSlug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return parseSpellPage(html, name);
}

// Sync all spells from wikidot
export async function syncWikidotSpells(options = {}) {
  const db = getDb();
  const { limit = null, startFrom = null } = options;

  console.log('Fetching spell list from dnd5e.wikidot.com...');
  let spellSlugs = await getSpellList();
  console.log(`Found ${spellSlugs.length} spells`);

  // Allow starting from a specific spell (for resuming)
  if (startFrom) {
    const startIdx = spellSlugs.indexOf(startFrom);
    if (startIdx > -1) {
      spellSlugs = spellSlugs.slice(startIdx);
      console.log(`Resuming from ${startFrom}, ${spellSlugs.length} remaining`);
    }
  }

  // Allow limiting for testing
  if (limit) {
    spellSlugs = spellSlugs.slice(0, limit);
    console.log(`Limited to ${limit} spells for testing`);
  }

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO dnd5e_spells (
      key, name, level, school, casting_time, range_text, duration,
      concentration, ritual, damage_roll, damage_types, saving_throw,
      attack_roll, classes, description, higher_level, source, raw_data
    ) VALUES (
      @key, @name, @level, @school, @casting_time, @range_text, @duration,
      @concentration, @ritual, @damage_roll, @damage_types, @saving_throw,
      @attack_roll, @classes, @description, @higher_level, @source, @raw_data
    )
  `);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < spellSlugs.length; i++) {
    const slug = spellSlugs[i];

    try {
      console.log(`[${i + 1}/${spellSlugs.length}] Scraping: ${slug}`);
      const spell = await scrapeSpell(slug);

      // Extract additional data from description
      const damageRoll = extractDamageRoll(spell.description);
      const damageTypes = extractDamageTypes(spell.description);
      const savingThrow = extractSavingThrow(spell.description);
      const attackRoll = hasAttackRoll(spell.description);

      insertStmt.run({
        key: `wikidot_${slug}`,
        name: spell.name,
        level: spell.level,
        school: spell.school,
        casting_time: spell.castingTime,
        range_text: spell.range,
        duration: spell.duration,
        concentration: spell.concentration ? 1 : 0,
        ritual: spell.ritual ? 1 : 0,
        damage_roll: damageRoll,
        damage_types: jsonStringify(damageTypes),
        saving_throw: savingThrow,
        attack_roll: attackRoll ? 1 : 0,
        classes: jsonStringify(spell.classes),
        description: spell.description,
        higher_level: spell.higherLevel,
        source: spell.source,
        raw_data: jsonStringify(spell)
      });

      successCount++;

    } catch (err) {
      console.error(`Error scraping ${slug}:`, err.message);
      errors.push({ slug, error: err.message });
      errorCount++;
    }

    // Rate limiting
    await delay(RATE_LIMIT_MS);
  }

  // Update sync status
  db.prepare(`
    INSERT OR REPLACE INTO sync_status (system_id, resource_type, last_synced, item_count)
    VALUES (?, 'wikidot_spells', datetime('now'), ?)
  `).run(SYSTEM_ID, successCount);

  console.log(`\nSync complete: ${successCount} spells synced, ${errorCount} errors`);

  if (errors.length > 0) {
    console.log('Errors:', errors.slice(0, 10));
  }

  return { success: successCount, errors: errorCount, errorList: errors };
}

// Test scraping a single spell
export async function testScrapeSpell(spellSlug) {
  const spell = await scrapeSpell(spellSlug);

  // Extract additional data
  spell.damageRoll = extractDamageRoll(spell.description);
  spell.damageTypes = extractDamageTypes(spell.description);
  spell.savingThrow = extractSavingThrow(spell.description);
  spell.attackRoll = hasAttackRoll(spell.description);

  return spell;
}

// Get list of spells from wikidot (for debugging)
export async function listWikidotSpells() {
  return getSpellList();
}
