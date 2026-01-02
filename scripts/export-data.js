#!/usr/bin/env node
// Export database to static JSON files for frontend consumption

import Database from 'better-sqlite3';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../backend/data/ttrpg.db');
const OUTPUT_DIR = join(__dirname, '../frontend/public/data');

// Ensure output directory exists
mkdirSync(OUTPUT_DIR, { recursive: true });

const db = new Database(DB_PATH, { readonly: true });

console.log('Exporting database to static JSON...\n');

// Export spells
const spells = db.prepare(`
  SELECT
    key, name, level, school, casting_time, range_text, duration,
    concentration, ritual, damage_roll, damage_types, saving_throw,
    attack_roll, classes, description, higher_level, source
  FROM dnd5e_spells
  ORDER BY level, name
`).all();

// Parse JSON fields
const processedSpells = spells.map(spell => ({
  ...spell,
  concentration: !!spell.concentration,
  ritual: !!spell.ritual,
  attackRoll: !!spell.attack_roll,
  damageTypes: spell.damage_types ? JSON.parse(spell.damage_types) : [],
  classes: spell.classes ? JSON.parse(spell.classes) : [],
  castingTime: spell.casting_time,
  rangeText: spell.range_text,
  damageRoll: spell.damage_roll,
  higherLevel: spell.higher_level,
  savingThrow: spell.saving_throw,
}));

// Remove snake_case duplicates
processedSpells.forEach(s => {
  delete s.casting_time;
  delete s.range_text;
  delete s.damage_roll;
  delete s.damage_types;
  delete s.higher_level;
  delete s.saving_throw;
  delete s.attack_roll;
});

writeFileSync(
  join(OUTPUT_DIR, 'spells.json'),
  JSON.stringify(processedSpells, null, 2)
);
console.log(`✓ Exported ${processedSpells.length} spells`);

// Export feats
const feats = db.prepare(`
  SELECT key, name, prerequisite, description, benefits, source
  FROM dnd5e_feats
  ORDER BY name
`).all();

const processedFeats = feats.map(feat => ({
  ...feat,
  benefits: feat.benefits ? JSON.parse(feat.benefits) : []
}));

writeFileSync(
  join(OUTPUT_DIR, 'feats.json'),
  JSON.stringify(processedFeats, null, 2)
);
console.log(`✓ Exported ${processedFeats.length} feats`);

// Export classes
const classes = db.prepare(`
  SELECT key, name, hit_die, primary_ability, saves, proficiencies,
         features, archetypes, spellcasting_ability, source
  FROM dnd5e_classes
  ORDER BY name
`).all();

const processedClasses = classes.map(cls => ({
  key: cls.key,
  name: cls.name,
  hitDie: cls.hit_die,
  primaryAbility: cls.primary_ability,
  saves: cls.saves ? JSON.parse(cls.saves) : [],
  proficiencies: cls.proficiencies ? JSON.parse(cls.proficiencies) : [],
  features: cls.features ? JSON.parse(cls.features) : [],
  archetypes: cls.archetypes ? JSON.parse(cls.archetypes) : [],
  spellcastingAbility: cls.spellcasting_ability,
  source: cls.source
}));

writeFileSync(
  join(OUTPUT_DIR, 'classes.json'),
  JSON.stringify(processedClasses, null, 2)
);
console.log(`✓ Exported ${processedClasses.length} classes`);

// Create an index/metadata file
const metadata = {
  exportedAt: new Date().toISOString(),
  counts: {
    spells: processedSpells.length,
    feats: processedFeats.length,
    classes: processedClasses.length
  },
  spellStats: {
    byLevel: {},
    bySchool: {},
    sources: [...new Set(processedSpells.map(s => s.source))]
  }
};

// Calculate spell stats
processedSpells.forEach(spell => {
  metadata.spellStats.byLevel[spell.level] = (metadata.spellStats.byLevel[spell.level] || 0) + 1;
  if (spell.school) {
    metadata.spellStats.bySchool[spell.school] = (metadata.spellStats.bySchool[spell.school] || 0) + 1;
  }
});

writeFileSync(
  join(OUTPUT_DIR, 'metadata.json'),
  JSON.stringify(metadata, null, 2)
);
console.log(`✓ Created metadata file`);

db.close();

console.log(`\nExport complete! Files written to: ${OUTPUT_DIR}`);
