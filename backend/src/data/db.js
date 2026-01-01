import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../../data/ttrpg.db');

let db = null;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initializeSchema();
  }
  return db;
}

function initializeSchema() {
  db.exec(`
    -- Core tables (system-agnostic)
    CREATE TABLE IF NOT EXISTS game_systems (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT,
      config TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      system_id TEXT REFERENCES game_systems(id),
      name TEXT NOT NULL,
      data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sync_status (
      system_id TEXT,
      resource_type TEXT,
      last_synced DATETIME,
      item_count INTEGER,
      PRIMARY KEY (system_id, resource_type)
    );

    -- D&D 5e (2014) specific tables
    CREATE TABLE IF NOT EXISTS dnd5e_spells (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      level INTEGER NOT NULL,
      school TEXT,
      casting_time TEXT,
      range_text TEXT,
      duration TEXT,
      concentration INTEGER DEFAULT 0,
      ritual INTEGER DEFAULT 0,
      damage_roll TEXT,
      damage_types TEXT,
      saving_throw TEXT,
      attack_roll INTEGER DEFAULT 0,
      classes TEXT,
      description TEXT,
      higher_level TEXT,
      source TEXT,
      raw_data TEXT
    );

    CREATE TABLE IF NOT EXISTS dnd5e_feats (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      prerequisite TEXT,
      description TEXT,
      benefits TEXT,
      source TEXT,
      raw_data TEXT
    );

    CREATE TABLE IF NOT EXISTS dnd5e_classes (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      hit_die TEXT,
      primary_ability TEXT,
      saves TEXT,
      proficiencies TEXT,
      features TEXT,
      archetypes TEXT,
      spellcasting_ability TEXT,
      source TEXT,
      raw_data TEXT
    );

    CREATE TABLE IF NOT EXISTS dnd5e_monsters (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      size TEXT,
      type TEXT,
      alignment TEXT,
      armor_class INTEGER,
      hit_points INTEGER,
      hit_dice TEXT,
      speed TEXT,
      strength INTEGER,
      dexterity INTEGER,
      constitution INTEGER,
      intelligence INTEGER,
      wisdom INTEGER,
      charisma INTEGER,
      challenge_rating TEXT,
      actions TEXT,
      special_abilities TEXT,
      source TEXT,
      raw_data TEXT
    );

    CREATE TABLE IF NOT EXISTS dnd5e_magic_items (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      rarity TEXT,
      requires_attunement INTEGER DEFAULT 0,
      description TEXT,
      source TEXT,
      raw_data TEXT
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_spells_level ON dnd5e_spells(level);
    CREATE INDEX IF NOT EXISTS idx_spells_school ON dnd5e_spells(school);
    CREATE INDEX IF NOT EXISTS idx_spells_concentration ON dnd5e_spells(concentration);
    CREATE INDEX IF NOT EXISTS idx_monsters_cr ON dnd5e_monsters(challenge_rating);

    -- Insert D&D 5e 2014 system if not exists
    INSERT OR IGNORE INTO game_systems (id, name, version)
    VALUES ('dnd5e-2014', 'Dungeons & Dragons 5th Edition', '2014');
  `);

  console.log('Database schema initialized');
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

// Helper functions for JSON fields
export function jsonStringify(obj) {
  return obj ? JSON.stringify(obj) : null;
}

export function jsonParse(str) {
  try {
    return str ? JSON.parse(str) : null;
  } catch {
    return null;
  }
}
