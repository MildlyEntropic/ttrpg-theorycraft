import { Router } from 'express';
import { getSpells, getSpell } from '../../systems/dnd5e-2014/data/spells.js';
import { getDb } from '../../data/db.js';

const router = Router();

// Generate wikidot-compatible page content for a spell
function spellToWikidot(spell) {
  const lines = [];

  // Source line
  lines.push(`Source: ${spell.source || 'Player\'s Handbook'}`);
  lines.push('');

  // Level and school
  if (spell.level === 0) {
    lines.push(`//${spell.school} cantrip//`);
  } else {
    const ordinal = spell.level === 1 ? '1st' :
                    spell.level === 2 ? '2nd' :
                    spell.level === 3 ? '3rd' :
                    `${spell.level}th`;
    lines.push(`//${ordinal}-level ${spell.school.toLowerCase()}${spell.ritual ? ' (ritual)' : ''}//`);
  }
  lines.push('');

  // Casting time
  lines.push(`**Casting Time:** ${spell.castingTime}`);

  // Range
  lines.push(`**Range:** ${spell.range}`);

  // Components - extract from description if available, otherwise use placeholder
  // Many spell descriptions mention components like "a tiny ball of bat guano and sulfur"
  let componentsStr = 'V, S';  // Default for most spells
  const desc = spell.description || '';

  // Try to detect if spell has no verbal/somatic from description patterns
  if (desc.toLowerCase().includes('no verbal') || desc.toLowerCase().includes('without speaking')) {
    componentsStr = 'S';
  }

  // Look for material component patterns in description
  const matPatterns = [
    /\(a\s+([^)]+)\)/i,  // "(a tiny ball of...)"
    /material component[s]?:?\s*([^.]+)/i,
    /using\s+(?:a\s+)?([^,.]+ worth (?:at least )?\d+[^,.]+)/i
  ];

  for (const pattern of matPatterns) {
    const match = desc.match(pattern);
    if (match) {
      componentsStr = `V, S, M (${match[1].trim()})`;
      break;
    }
  }

  // Note: Components defaulted to V, S - verify against source material
  lines.push(`**Components:** ${componentsStr}`);

  // Duration
  let duration = spell.duration;
  if (spell.concentration && !duration.toLowerCase().includes('concentration')) {
    duration = `Concentration, up to ${duration}`;
  }
  lines.push(`**Duration:** ${duration}`);
  lines.push('');

  // Description - strip "Source: X" prefix and clean up
  // Format is "Source: Player's Handbook Some actual description..."
  // Match "Source: " followed by the book name (words until we hit a sentence start)
  let descClean = desc.replace(/^Source:\s*(?:Player's Handbook|Xanathar's Guide to Everything|Tasha's Cauldron of Everything|Sword Coast Adventurer's Guide|Explorer's Guide to Wildemount|Acquisitions Incorporated|Strixhaven: A Curriculum of Chaos|Fizban's Treasury of Dragons|[A-Z][^.]+?)\s+(?=[A-Z])/i, '').trim();

  // Remove any leading metadata that might have leaked in
  descClean = descClean.replace(/^(Casting Time|Range|Components|Duration):.*$/gm, '').trim();

  if (descClean) {
    lines.push(descClean);
  }

  // Higher levels
  if (spell.higherLevel) {
    lines.push('');
    lines.push(`**//At Higher Levels.//** ${spell.higherLevel}`);
  }

  // Spell lists
  if (spell.classes && spell.classes.length > 0) {
    lines.push('');
    const classList = spell.classes
      .map(c => `[[[spells:${c.toLowerCase()}|${c}]]]`)
      .join(', ');
    lines.push(`**//Spell Lists.//** ${classList}`);
  }

  return lines.join('\n');
}

// Generate wikidot page name for a spell
function spellToWikidotKey(spell) {
  return spell.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

// Export a single spell in wikidot format
router.get('/wikidot/spell/:key', (req, res) => {
  try {
    const spell = getSpell(req.params.key);
    if (!spell) {
      return res.status(404).json({ error: 'Spell not found' });
    }

    const wikidotKey = spellToWikidotKey(spell);
    const wikidotContent = spellToWikidot(spell);

    // Get tags for the page
    const tags = [spell.school.toLowerCase()];
    const levelTag = spell.level === 0 ? 'cantrip' :
                     spell.level === 1 ? 'first' :
                     spell.level === 2 ? 'second' :
                     spell.level === 3 ? 'third' :
                     spell.level === 4 ? 'fourth' :
                     spell.level === 5 ? 'fifth' :
                     spell.level === 6 ? 'sixth' :
                     spell.level === 7 ? 'seventh' :
                     spell.level === 8 ? 'eighth' : 'ninth';
    tags.push(levelTag);
    if (spell.classes) {
      tags.push(...spell.classes.map(c => c.toLowerCase()));
    }

    res.json({
      originalKey: spell.key,
      wikidotPageName: `spell:${wikidotKey}`,
      wikidotUrl: `http://dnd2014.wikidot.com/spell:${wikidotKey}`,
      tags: tags,
      content: wikidotContent
    });
  } catch (error) {
    console.error('Error exporting spell:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export all spells in wikidot format (paginated)
router.get('/wikidot/spells', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;

    const allSpells = getSpells({ limit: 1000, offset: 0 });
    const spells = allSpells.slice(offset, offset + limit);

    const exports = spells.map(spell => {
      const wikidotKey = spellToWikidotKey(spell);
      return {
        name: spell.name,
        wikidotPageName: `spell:${wikidotKey}`,
        level: spell.level,
        school: spell.school,
        content: spellToWikidot(spell)
      };
    });

    res.json({
      exports,
      pagination: {
        total: allSpells.length,
        offset,
        limit,
        hasMore: offset + limit < allSpells.length
      },
      instructions: {
        purpose: 'Export data for dnd2014.wikidot.com',
        howToUse: [
          '1. Each entry contains the wikidot page name and content',
          '2. On dnd2014.wikidot.com, create a new page with the wikidotPageName',
          '3. Paste the content into the page editor',
          '4. The content uses wikidot markup syntax',
          '5. Attribution: This data is from dnd5e.wikidot.com under CC-BY-SA 3.0'
        ],
        license: 'CC-BY-SA 3.0',
        attribution: 'Data scraped from dnd5e.wikidot.com'
      }
    });
  } catch (error) {
    console.error('Error exporting spells:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate wikidot page content for a feat
function featToWikidot(feat) {
  const lines = [];

  // Source
  lines.push(`Source: ${feat.source || 'Player\'s Handbook'}`);
  lines.push('');

  // Prerequisite
  if (feat.prerequisite) {
    lines.push(`//Prerequisite: ${feat.prerequisite}//`);
    lines.push('');
  }

  // Description
  if (feat.description) {
    lines.push(feat.description);
  }

  return lines.join('\n');
}

// Export feats in wikidot format
router.get('/wikidot/feats', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT key, name, prerequisite, description, source
      FROM dnd5e_feats
      ORDER BY name
    `);
    const feats = stmt.all();

    const exports = feats.map(feat => {
      const wikidotKey = feat.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-');

      return {
        name: feat.name,
        wikidotPageName: `feat:${wikidotKey}`,
        prerequisite: feat.prerequisite,
        content: featToWikidot(feat)
      };
    });

    res.json({
      exports,
      total: exports.length,
      instructions: {
        purpose: 'Export feats for dnd2014.wikidot.com',
        license: 'CC-BY-SA 3.0',
        attribution: 'Data scraped from dnd5e.wikidot.com'
      }
    });
  } catch (error) {
    console.error('Error exporting feats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export lineages/races in wikidot format
router.get('/wikidot/lineages', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT key, name, ability_scores, size, speed, traits, languages, source, description
      FROM dnd5e_lineages
      ORDER BY name
    `);
    const lineages = stmt.all();

    const exports = lineages.map(lineage => {
      const wikidotKey = lineage.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-');

      const lines = [];
      lines.push(`Source: ${lineage.source || 'Player\'s Handbook'}`);
      lines.push('');

      // Clean description - skip if it's just a source reference
      if (lineage.description) {
        let desc = lineage.description.trim();
        // Skip if description is only "Source: X" with no actual content
        if (!desc.match(/^Source:\s*[^.]+\.?$/i)) {
          // Strip source prefix if present
          desc = desc.replace(/^Source:\s*[^\n]+\n*/i, '').trim();
          if (desc) {
            lines.push(desc);
            lines.push('');
          }
        }
      }

      // Ability scores
      if (lineage.ability_scores) {
        try {
          const scores = JSON.parse(lineage.ability_scores);
          if (Object.keys(scores).length > 0) {
            const scoreStr = Object.entries(scores)
              .map(([k, v]) => `${k} +${v}`)
              .join(', ');
            lines.push(`**Ability Score Increase.** ${scoreStr}`);
            lines.push('');
          }
        } catch (e) {}
      }

      if (lineage.size) {
        lines.push(`**Size.** ${lineage.size}`);
        lines.push('');
      }

      if (lineage.speed) {
        lines.push(`**Speed.** ${lineage.speed}`);
        lines.push('');
      }

      if (lineage.languages && lineage.languages !== '[]') {
        let langs = lineage.languages;
        // Parse if it's JSON array
        try {
          const parsed = JSON.parse(langs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            langs = parsed.join(', ');
          }
        } catch (e) {}
        if (langs && langs !== '[]') {
          lines.push(`**Languages.** ${langs}`);
          lines.push('');
        }
      }

      // Traits
      if (lineage.traits) {
        try {
          const traits = JSON.parse(lineage.traits);
          if (Array.isArray(traits)) {
            for (const trait of traits) {
              if (trait.name && trait.description) {
                lines.push(`**${trait.name}.** ${trait.description}`);
                lines.push('');
              }
            }
          }
        } catch (e) {}
      }

      return {
        name: lineage.name,
        wikidotPageName: `lineage:${wikidotKey}`,
        content: lines.join('\n').trim()
      };
    });

    res.json({
      exports,
      total: exports.length,
      instructions: {
        purpose: 'Export races/lineages for dnd2014.wikidot.com',
        license: 'CC-BY-SA 3.0',
        attribution: 'Data scraped from dnd5e.wikidot.com'
      }
    });
  } catch (error) {
    console.error('Error exporting lineages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Summary of all exportable content
router.get('/wikidot/summary', (req, res) => {
  try {
    const db = getDb();

    const spellCount = getSpells({ limit: 1000 }).length;
    const featCount = db.prepare('SELECT COUNT(*) as count FROM dnd5e_feats').get().count;
    const lineageCount = db.prepare('SELECT COUNT(*) as count FROM dnd5e_lineages').get().count;
    const classCount = db.prepare('SELECT COUNT(*) as count FROM dnd5e_classes').get().count;

    res.json({
      summary: {
        spells: spellCount,
        feats: featCount,
        lineages: lineageCount,
        subclasses: classCount
      },
      endpoints: {
        spells: '/api/export/wikidot/spells',
        spell: '/api/export/wikidot/spell/:key',
        feats: '/api/export/wikidot/feats',
        lineages: '/api/export/wikidot/lineages'
      },
      targetWiki: 'http://dnd2014.wikidot.com',
      sourceWiki: 'http://dnd5e.wikidot.com',
      license: 'CC-BY-SA 3.0',
      note: 'This export is designed to help populate dnd2014.wikidot.com with 2014 D&D content'
    });
  } catch (error) {
    console.error('Error getting export summary:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
