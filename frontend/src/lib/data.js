// Static data loader - loads JSON files instead of API calls
// All data is loaded once and cached in memory

let spellsCache = null;
let featsCache = null;
let classesCache = null;
let metadataCache = null;

// Load spells from static JSON
export async function loadSpells() {
  if (spellsCache) return spellsCache;

  const response = await fetch('/data/spells.json');
  spellsCache = await response.json();
  return spellsCache;
}

// Load feats from static JSON
export async function loadFeats() {
  if (featsCache) return featsCache;

  const response = await fetch('/data/feats.json');
  featsCache = await response.json();
  return featsCache;
}

// Load classes from static JSON
export async function loadClasses() {
  if (classesCache) return classesCache;

  const response = await fetch('/data/classes.json');
  classesCache = await response.json();
  return classesCache;
}

// Load metadata
export async function loadMetadata() {
  if (metadataCache) return metadataCache;

  const response = await fetch('/data/metadata.json');
  metadataCache = await response.json();
  return metadataCache;
}

// Get all spells with optional filtering
export async function getSpells(filters = {}) {
  const spells = await loadSpells();

  return spells.filter(spell => {
    if (filters.level !== undefined && filters.level !== '' && spell.level !== parseInt(filters.level)) {
      return false;
    }
    if (filters.school && spell.school?.toLowerCase() !== filters.school.toLowerCase()) {
      return false;
    }
    if (filters.class && !spell.classes?.some(c => c.toLowerCase() === filters.class.toLowerCase())) {
      return false;
    }
    if (filters.concentration !== undefined && spell.concentration !== filters.concentration) {
      return false;
    }
    if (filters.ritual !== undefined && spell.ritual !== filters.ritual) {
      return false;
    }
    if (filters.damageType && !spell.damageTypes?.includes(filters.damageType)) {
      return false;
    }
    if (filters.source && spell.source !== filters.source) {
      return false;
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return spell.name.toLowerCase().includes(searchLower) ||
             spell.description?.toLowerCase().includes(searchLower);
    }
    return true;
  });
}

// Get a single spell by key
export async function getSpell(key) {
  const spells = await loadSpells();
  return spells.find(s => s.key === key);
}

// Search spells by name
export async function searchSpells(query, limit = 20) {
  const spells = await loadSpells();
  const queryLower = query.toLowerCase();

  return spells
    .filter(s => s.name.toLowerCase().includes(queryLower))
    .slice(0, limit);
}

// Get spell stats (counts by level, school, etc.)
export async function getSpellStats() {
  const metadata = await loadMetadata();
  return metadata.spellStats;
}

// Get damage spells only
export async function getDamageSpells() {
  const spells = await loadSpells();
  return spells.filter(s => s.damageRoll);
}

// Get unique values for filters
export async function getFilterOptions() {
  const spells = await loadSpells();

  const schools = [...new Set(spells.map(s => s.school).filter(Boolean))].sort();
  const classes = [...new Set(spells.flatMap(s => s.classes || []))].sort();
  const damageTypes = [...new Set(spells.flatMap(s => s.damageTypes || []))].sort();
  const sources = [...new Set(spells.map(s => s.source).filter(Boolean))].sort();

  return {
    schools,
    classes,
    damageTypes,
    sources,
    levels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  };
}

// Preload all data (call on app init for faster UX)
export async function preloadAllData() {
  await Promise.all([
    loadSpells(),
    loadFeats(),
    loadClasses(),
    loadMetadata()
  ]);
}
