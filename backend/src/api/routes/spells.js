import { Router } from 'express';
import {
  getSpells,
  getSpell,
  getSpellCount,
  getSchools,
  getSpellLevelStats,
  getDamageSpells,
  searchSpells
} from '../../systems/dnd5e-2014/data/spells.js';
import {
  analyzeSpell,
  compareSpells,
  getBestSpellsForSlot,
  analyzeCantripScaling
} from '../../systems/dnd5e-2014/analyzers/spell-dpr.js';

const router = Router();

// List all spells with filtering
router.get('/', (req, res) => {
  try {
    const options = {
      // Source filter: 'wikidot' (default, full PHB), 'srd' (SRD 5.1 only), 'all' (everything)
      source: req.query.source,
      allSources: req.query.allSources === 'true',
      level: req.query.level !== undefined ? parseInt(req.query.level) : undefined,
      minLevel: req.query.minLevel !== undefined ? parseInt(req.query.minLevel) : undefined,
      maxLevel: req.query.maxLevel !== undefined ? parseInt(req.query.maxLevel) : undefined,
      school: req.query.school,
      concentration: req.query.concentration === 'true' ? true :
                     req.query.concentration === 'false' ? false : undefined,
      ritual: req.query.ritual === 'true' ? true :
              req.query.ritual === 'false' ? false : undefined,
      hasDamage: req.query.hasDamage === 'true',
      savingThrow: req.query.savingThrow,
      attackRoll: req.query.attackRoll === 'true' ? true :
                  req.query.attackRoll === 'false' ? false : undefined,
      className: req.query.class,
      search: req.query.search,
      limit: req.query.limit ? parseInt(req.query.limit) : 100,
      offset: req.query.offset ? parseInt(req.query.offset) : 0
    };

    const spells = getSpells(options);
    const total = getSpellCount(options);

    res.json({
      spells,
      pagination: {
        total,
        limit: options.limit,
        offset: options.offset,
        hasMore: options.offset + spells.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching spells:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get spell statistics
router.get('/stats', (req, res) => {
  try {
    const levelStats = getSpellLevelStats();
    const schools = getSchools();
    const totalSpells = getSpellCount();
    const damageSpells = getSpellCount({ hasDamage: true });

    res.json({
      total: totalSpells,
      damageSpells,
      byLevel: levelStats,
      schools
    });
  } catch (error) {
    console.error('Error fetching spell stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search spells
router.get('/search', (req, res) => {
  try {
    const { q, limit } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const spells = searchSpells(q, limit ? parseInt(limit) : 20);
    res.json({ spells, query: q });
  } catch (error) {
    console.error('Error searching spells:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get damage-dealing spells
router.get('/damage', (req, res) => {
  try {
    const spells = getDamageSpells();
    res.json({ spells, count: spells.length });
  } catch (error) {
    console.error('Error fetching damage spells:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze a single spell
router.get('/:key/analyze', (req, res) => {
  try {
    const spell = getSpell(req.params.key);
    if (!spell) {
      return res.status(404).json({ error: 'Spell not found' });
    }

    const context = {
      casterLevel: req.query.casterLevel ? parseInt(req.query.casterLevel) : 5,
      spellcastingMod: req.query.spellMod ? parseInt(req.query.spellMod) : 4,
      proficiencyBonus: req.query.profBonus ? parseInt(req.query.profBonus) : 3,
      targetAC: req.query.targetAC ? parseInt(req.query.targetAC) : 15,
      expectedTargets: req.query.targets ? parseInt(req.query.targets) : 1
    };

    // Parse target saves if provided
    if (req.query.targetSaves) {
      try {
        context.targetSaves = JSON.parse(req.query.targetSaves);
      } catch (e) {
        // Use defaults
      }
    }

    const analysis = analyzeSpell(spell, context);
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing spell:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a single spell by key
router.get('/:key', (req, res) => {
  try {
    const spell = getSpell(req.params.key);
    if (!spell) {
      return res.status(404).json({ error: 'Spell not found' });
    }
    res.json(spell);
  } catch (error) {
    console.error('Error fetching spell:', error);
    res.status(500).json({ error: error.message });
  }
});

// Compare multiple spells (POST with spell keys in body)
router.post('/compare', (req, res) => {
  try {
    const { spellKeys, context } = req.body;

    if (!spellKeys || !Array.isArray(spellKeys)) {
      return res.status(400).json({ error: 'spellKeys array is required' });
    }

    const spells = spellKeys.map(key => getSpell(key)).filter(Boolean);

    if (spells.length === 0) {
      return res.status(404).json({ error: 'No valid spells found' });
    }

    const comparison = compareSpells(spells, context || {});
    res.json(comparison);
  } catch (error) {
    console.error('Error comparing spells:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get best spells for a slot level
router.get('/best/:slotLevel', (req, res) => {
  try {
    const slotLevel = parseInt(req.params.slotLevel);
    if (isNaN(slotLevel) || slotLevel < 1 || slotLevel > 9) {
      return res.status(400).json({ error: 'Invalid slot level (1-9)' });
    }

    const context = {
      casterLevel: req.query.casterLevel ? parseInt(req.query.casterLevel) : 5,
      spellcastingMod: req.query.spellMod ? parseInt(req.query.spellMod) : 4,
      targetAC: req.query.targetAC ? parseInt(req.query.targetAC) : 15,
      expectedTargets: req.query.targets ? parseInt(req.query.targets) : 1
    };

    const allSpells = getSpells({ maxLevel: slotLevel });
    const best = getBestSpellsForSlot(allSpells, slotLevel, context);

    res.json({
      slotLevel,
      context,
      bestSpells: best
    });
  } catch (error) {
    console.error('Error getting best spells:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze cantrip scaling
router.get('/:key/cantrip-scaling', (req, res) => {
  try {
    const spell = getSpell(req.params.key);
    if (!spell) {
      return res.status(404).json({ error: 'Spell not found' });
    }

    if (spell.level !== 0) {
      return res.status(400).json({ error: 'Not a cantrip' });
    }

    const scaling = analyzeCantripScaling(spell);
    res.json({
      spell: spell.name,
      scaling
    });
  } catch (error) {
    console.error('Error analyzing cantrip:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
