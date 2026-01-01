import { getDb, jsonStringify } from '../../../data/db.js';
import { API_BASE, ENDPOINTS, SYSTEM_ID, PAGE_SIZE } from './sources.js';

// Generic paginated fetch from Open5e API
async function fetchAllPages(endpoint) {
  const results = [];
  let url = `${API_BASE}${endpoint}?limit=${PAGE_SIZE}`;

  while (url) {
    console.log(`Fetching: ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    results.push(...data.results);

    // Handle pagination - Open5e uses 'next' for v2 endpoints
    url = data.next || null;

    // Rate limiting - be nice to the API
    if (url) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

// Sync spells from Open5e
export async function syncSpells() {
  const db = getDb();
  console.log('Syncing spells from Open5e...');

  const spells = await fetchAllPages(ENDPOINTS.spells);
  console.log(`Fetched ${spells.length} spells`);

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

  const insertMany = db.transaction((spells) => {
    for (const spell of spells) {
      // Try to extract saving throw from description if not provided
      let savingThrow = spell.saving_throw_ability || null;
      if (!savingThrow && spell.desc) {
        const saveMatch = spell.desc.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving\s+throw/i);
        if (saveMatch) {
          savingThrow = saveMatch[1].toLowerCase();
        }
      }

      // Try to extract damage roll if not provided
      let damageRoll = spell.damage_roll || null;
      if (!damageRoll && spell.desc) {
        // Look for damage patterns like "3d6 fire damage" or "takes 8d6 damage"
        const dmgMatch = spell.desc.match(/(\d+d\d+(?:\s*\+\s*\d+)?)\s+(?:\w+\s+)?damage/i);
        if (dmgMatch) {
          damageRoll = dmgMatch[1];
        }
      }

      insertStmt.run({
        key: spell.key || spell.slug,
        name: spell.name,
        level: parseInt(spell.level) || 0,
        school: spell.school?.name || spell.school || null,
        casting_time: spell.casting_time,
        range_text: spell.range_text || spell.range,
        duration: spell.duration,
        concentration: spell.concentration ? 1 : 0,
        ritual: spell.ritual ? 1 : 0,
        damage_roll: damageRoll,
        damage_types: jsonStringify(spell.damage_types),
        saving_throw: savingThrow,
        attack_roll: spell.attack_roll ? 1 : 0,
        classes: jsonStringify(spell.classes),
        description: spell.desc,
        higher_level: spell.higher_level,
        source: spell.document?.name || 'SRD',
        raw_data: jsonStringify(spell)
      });
    }
  });

  insertMany(spells);

  // Update sync status
  db.prepare(`
    INSERT OR REPLACE INTO sync_status (system_id, resource_type, last_synced, item_count)
    VALUES (?, 'spells', datetime('now'), ?)
  `).run(SYSTEM_ID, spells.length);

  console.log(`Synced ${spells.length} spells to database`);
  return spells.length;
}

// Sync feats from Open5e
export async function syncFeats() {
  const db = getDb();
  console.log('Syncing feats from Open5e...');

  const feats = await fetchAllPages(ENDPOINTS.feats);
  console.log(`Fetched ${feats.length} feats`);

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO dnd5e_feats (
      key, name, prerequisite, description, benefits, source, raw_data
    ) VALUES (
      @key, @name, @prerequisite, @description, @benefits, @source, @raw_data
    )
  `);

  const insertMany = db.transaction((feats) => {
    for (const feat of feats) {
      insertStmt.run({
        key: feat.key || feat.slug,
        name: feat.name,
        prerequisite: feat.prerequisite || null,
        description: feat.desc,
        benefits: jsonStringify(feat.benefits),
        source: feat.document?.name || 'SRD',
        raw_data: jsonStringify(feat)
      });
    }
  });

  insertMany(feats);

  db.prepare(`
    INSERT OR REPLACE INTO sync_status (system_id, resource_type, last_synced, item_count)
    VALUES (?, 'feats', datetime('now'), ?)
  `).run(SYSTEM_ID, feats.length);

  console.log(`Synced ${feats.length} feats to database`);
  return feats.length;
}

// Sync classes from Open5e
export async function syncClasses() {
  const db = getDb();
  console.log('Syncing classes from Open5e...');

  const classes = await fetchAllPages(ENDPOINTS.classes);
  console.log(`Fetched ${classes.length} classes`);

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO dnd5e_classes (
      key, name, hit_die, primary_ability, saves, proficiencies,
      features, archetypes, spellcasting_ability, source, raw_data
    ) VALUES (
      @key, @name, @hit_die, @primary_ability, @saves, @proficiencies,
      @features, @archetypes, @spellcasting_ability, @source, @raw_data
    )
  `);

  const insertMany = db.transaction((classes) => {
    for (const cls of classes) {
      insertStmt.run({
        key: cls.slug,
        name: cls.name,
        hit_die: cls.hit_dice,
        primary_ability: cls.spellcasting_ability || null,
        saves: jsonStringify(cls.prof_saving_throws),
        proficiencies: jsonStringify({
          armor: cls.prof_armor,
          weapons: cls.prof_weapons,
          tools: cls.prof_tools,
          skills: cls.prof_skills
        }),
        features: jsonStringify(cls.table),
        archetypes: jsonStringify(cls.archetypes),
        spellcasting_ability: cls.spellcasting_ability || null,
        source: cls.document__slug || 'SRD',
        raw_data: jsonStringify(cls)
      });
    }
  });

  insertMany(classes);

  db.prepare(`
    INSERT OR REPLACE INTO sync_status (system_id, resource_type, last_synced, item_count)
    VALUES (?, 'classes', datetime('now'), ?)
  `).run(SYSTEM_ID, classes.length);

  console.log(`Synced ${classes.length} classes to database`);
  return classes.length;
}

// Sync monsters from Open5e
export async function syncMonsters() {
  const db = getDb();
  console.log('Syncing monsters from Open5e...');

  const monsters = await fetchAllPages(ENDPOINTS.monsters);
  console.log(`Fetched ${monsters.length} monsters`);

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO dnd5e_monsters (
      key, name, size, type, alignment, armor_class, hit_points, hit_dice,
      speed, strength, dexterity, constitution, intelligence, wisdom, charisma,
      challenge_rating, actions, special_abilities, source, raw_data
    ) VALUES (
      @key, @name, @size, @type, @alignment, @armor_class, @hit_points, @hit_dice,
      @speed, @strength, @dexterity, @constitution, @intelligence, @wisdom, @charisma,
      @challenge_rating, @actions, @special_abilities, @source, @raw_data
    )
  `);

  const insertMany = db.transaction((monsters) => {
    for (const monster of monsters) {
      insertStmt.run({
        key: monster.slug,
        name: monster.name,
        size: monster.size,
        type: monster.type,
        alignment: monster.alignment,
        armor_class: monster.armor_class,
        hit_points: monster.hit_points,
        hit_dice: monster.hit_dice,
        speed: jsonStringify(monster.speed),
        strength: monster.strength,
        dexterity: monster.dexterity,
        constitution: monster.constitution,
        intelligence: monster.intelligence,
        wisdom: monster.wisdom,
        charisma: monster.charisma,
        challenge_rating: monster.challenge_rating,
        actions: jsonStringify(monster.actions),
        special_abilities: jsonStringify(monster.special_abilities),
        source: monster.document__slug || 'SRD',
        raw_data: jsonStringify(monster)
      });
    }
  });

  insertMany(monsters);

  db.prepare(`
    INSERT OR REPLACE INTO sync_status (system_id, resource_type, last_synced, item_count)
    VALUES (?, 'monsters', datetime('now'), ?)
  `).run(SYSTEM_ID, monsters.length);

  console.log(`Synced ${monsters.length} monsters to database`);
  return monsters.length;
}

// Sync magic items from Open5e
export async function syncMagicItems() {
  const db = getDb();
  console.log('Syncing magic items from Open5e...');

  const items = await fetchAllPages(ENDPOINTS.magicItems);
  console.log(`Fetched ${items.length} magic items`);

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO dnd5e_magic_items (
      key, name, type, rarity, requires_attunement, description, source, raw_data
    ) VALUES (
      @key, @name, @type, @rarity, @requires_attunement, @description, @source, @raw_data
    )
  `);

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insertStmt.run({
        key: item.slug,
        name: item.name,
        type: item.type,
        rarity: item.rarity,
        requires_attunement: item.requires_attunement ? 1 : 0,
        description: item.desc,
        source: item.document__slug || 'SRD',
        raw_data: jsonStringify(item)
      });
    }
  });

  insertMany(items);

  db.prepare(`
    INSERT OR REPLACE INTO sync_status (system_id, resource_type, last_synced, item_count)
    VALUES (?, 'magic_items', datetime('now'), ?)
  `).run(SYSTEM_ID, items.length);

  console.log(`Synced ${items.length} magic items to database`);
  return items.length;
}

// Sync all data
export async function syncAll() {
  const results = {
    spells: await syncSpells(),
    feats: await syncFeats(),
    classes: await syncClasses(),
    monsters: await syncMonsters(),
    magicItems: await syncMagicItems()
  };

  console.log('Sync complete:', results);
  return results;
}

// Get sync status
export function getSyncStatus() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT resource_type, last_synced, item_count
    FROM sync_status
    WHERE system_id = ?
  `).all(SYSTEM_ID);

  return rows.reduce((acc, row) => {
    acc[row.resource_type] = {
      lastSynced: row.last_synced,
      itemCount: row.item_count
    };
    return acc;
  }, {});
}
