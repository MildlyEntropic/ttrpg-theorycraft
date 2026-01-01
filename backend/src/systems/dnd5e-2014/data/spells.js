import { getDb, jsonParse } from '../../../data/db.js';

// Transform database row to spell object
function rowToSpell(row) {
  if (!row) return null;
  return {
    key: row.key,
    name: row.name,
    level: row.level,
    school: row.school,
    castingTime: row.casting_time,
    range: row.range_text,
    duration: row.duration,
    concentration: !!row.concentration,
    ritual: !!row.ritual,
    damageRoll: row.damage_roll,
    damageTypes: jsonParse(row.damage_types) || [],
    savingThrow: row.saving_throw,
    attackRoll: !!row.attack_roll,
    classes: jsonParse(row.classes) || [],
    description: row.description,
    higherLevel: row.higher_level,
    source: row.source
  };
}

// Source filters for different data sources
// Keys: srd_* (5.1), srd-2024_* (2024), a5e-ag_* (A5E), deepm_* (Deep Magic), wikidot_* (PHB complete)
const SOURCE_FILTERS = {
  srd: "key LIKE 'srd\\_%' ESCAPE '\\'",      // SRD 5.1 only (Open5e)
  wikidot: "key LIKE 'wikidot\\_%' ESCAPE '\\'", // Full PHB content (dnd5e.wikidot.com, CC-BY-SA 3.0)
  all: null  // No filter
};

// Default to wikidot for more complete spell list
const DEFAULT_SOURCE = 'wikidot';

// Get the source filter SQL for a given source option
function getSourceFilter(source) {
  if (source === true || source === 'all') return null;  // allSources=true for backwards compat
  const filter = SOURCE_FILTERS[source || DEFAULT_SOURCE];
  return filter !== undefined ? filter : SOURCE_FILTERS[DEFAULT_SOURCE];
}

// Get all spells with optional filtering
export function getSpells(options = {}) {
  const db = getDb();
  const conditions = [];
  const params = {};

  // Apply source filter (defaults to wikidot for complete PHB spells)
  // Use source='srd' for SRD-only, source='all' or allSources=true for everything
  const sourceFilter = getSourceFilter(options.allSources === true ? 'all' : options.source);
  if (sourceFilter) {
    conditions.push(sourceFilter);
  }

  if (options.level !== undefined) {
    conditions.push('level = @level');
    params.level = options.level;
  }

  if (options.minLevel !== undefined) {
    conditions.push('level >= @minLevel');
    params.minLevel = options.minLevel;
  }

  if (options.maxLevel !== undefined) {
    conditions.push('level <= @maxLevel');
    params.maxLevel = options.maxLevel;
  }

  if (options.school) {
    conditions.push('LOWER(school) = LOWER(@school)');
    params.school = options.school;
  }

  if (options.concentration !== undefined) {
    conditions.push('concentration = @concentration');
    params.concentration = options.concentration ? 1 : 0;
  }

  if (options.ritual !== undefined) {
    conditions.push('ritual = @ritual');
    params.ritual = options.ritual ? 1 : 0;
  }

  if (options.hasDamage) {
    conditions.push("damage_roll IS NOT NULL AND damage_roll != ''");
  }

  if (options.savingThrow) {
    conditions.push('LOWER(saving_throw) = LOWER(@savingThrow)');
    params.savingThrow = options.savingThrow;
  }

  if (options.attackRoll !== undefined) {
    conditions.push('attack_roll = @attackRoll');
    params.attackRoll = options.attackRoll ? 1 : 0;
  }

  if (options.className) {
    // Search within JSON array of classes
    conditions.push('classes LIKE @className');
    params.className = `%${options.className}%`;
  }

  if (options.search) {
    conditions.push('(LOWER(name) LIKE @search OR LOWER(description) LIKE @search)');
    params.search = `%${options.search.toLowerCase()}%`;
  }

  let sql = 'SELECT * FROM dnd5e_spells';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  // Ordering
  const orderBy = options.orderBy || 'level, name';
  sql += ` ORDER BY ${orderBy}`;

  // Pagination
  if (options.limit) {
    sql += ' LIMIT @limit';
    params.limit = options.limit;
  }
  if (options.offset) {
    sql += ' OFFSET @offset';
    params.offset = options.offset;
  }

  const rows = db.prepare(sql).all(params);
  return rows.map(rowToSpell);
}

// Get a single spell by key
export function getSpell(key) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM dnd5e_spells WHERE key = ?').get(key);
  return rowToSpell(row);
}

// Get spell count
export function getSpellCount(options = {}) {
  const db = getDb();
  const conditions = [];
  const params = {};

  // Apply source filter
  const sourceFilter = getSourceFilter(options.allSources === true ? 'all' : options.source);
  if (sourceFilter) {
    conditions.push(sourceFilter);
  }

  if (options.level !== undefined) {
    conditions.push('level = @level');
    params.level = options.level;
  }

  if (options.hasDamage) {
    conditions.push("damage_roll IS NOT NULL AND damage_roll != ''");
  }

  let sql = 'SELECT COUNT(*) as count FROM dnd5e_spells';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  return db.prepare(sql).get(params).count;
}

// Get all unique schools
export function getSchools(source = DEFAULT_SOURCE) {
  const db = getDb();
  const sourceFilter = getSourceFilter(source);
  const whereClause = sourceFilter
    ? `WHERE school IS NOT NULL AND ${sourceFilter}`
    : 'WHERE school IS NOT NULL';
  const rows = db.prepare(`SELECT DISTINCT school FROM dnd5e_spells ${whereClause} ORDER BY school`).all();
  return rows.map(r => r.school);
}

// Get spell levels with counts
export function getSpellLevelStats(source = DEFAULT_SOURCE) {
  const db = getDb();
  const sourceFilter = getSourceFilter(source);
  const whereClause = sourceFilter ? `WHERE ${sourceFilter}` : '';
  const rows = db.prepare(`
    SELECT level, COUNT(*) as count
    FROM dnd5e_spells
    ${whereClause}
    GROUP BY level
    ORDER BY level
  `).all();

  return rows.map(r => ({
    level: r.level,
    count: r.count,
    label: r.level === 0 ? 'Cantrip' : `Level ${r.level}`
  }));
}

// Get damage spells for analysis
export function getDamageSpells(source = DEFAULT_SOURCE) {
  const db = getDb();
  const sourceFilter = getSourceFilter(source);
  const whereClause = sourceFilter
    ? `WHERE damage_roll IS NOT NULL AND damage_roll != '' AND ${sourceFilter}`
    : "WHERE damage_roll IS NOT NULL AND damage_roll != ''";
  const rows = db.prepare(`
    SELECT * FROM dnd5e_spells
    ${whereClause}
    ORDER BY level, name
  `).all();
  return rows.map(rowToSpell);
}

// Get spells by class
export function getSpellsByClass(className) {
  return getSpells({ className });
}

// Search spells
export function searchSpells(query, limit = 20) {
  return getSpells({ search: query, limit });
}
