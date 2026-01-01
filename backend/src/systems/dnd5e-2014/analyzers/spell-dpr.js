import { calculateAverage, parseDiceExpression, scaleSpellDamage, getDiceSummary } from '../../../engine/calculator/dice.js';

// Spells with choosable damage types (caster picks at cast time)
// This is a strategic advantage - can bypass resistances
const DAMAGE_TYPE_CHOICE_SPELLS = {
  'chromatic-orb': ['acid', 'cold', 'fire', 'lightning', 'poison', 'thunder'],
  'dragons-breath': ['acid', 'cold', 'fire', 'lightning', 'poison'],
  'elemental-bane': ['acid', 'cold', 'fire', 'lightning'],  // Targets vulnerability
  'elemental-weapon': ['acid', 'cold', 'fire', 'lightning', 'thunder'],
  'glyph-of-warding': ['acid', 'cold', 'fire', 'lightning', 'thunder'],
  'spirit-shroud': ['cold', 'necrotic', 'radiant'],
  'flame-blade': ['fire'],  // Not a choice, but listed for completeness
};

// Spells with non-standard damage formulas that the scraper may have parsed incorrectly
// These override the scraped damageRoll with the correct formula
const SPECIAL_DAMAGE_FORMULAS = {
  // Chaos Bolt: 2d8 + 1d6, not just 1d6 (scraper captured the d6 but missed the 2d8)
  // At higher levels: +1d6 per slot level above 1st
  'chaos-bolt': {
    baseDamage: '2d8+1d6',
    slotScaling: '1d6',  // Per slot level above 1st
    // Chain mechanic: when both d8s match (1/8 = 12.5%), bounces to another target
    chainChance: 0.125,
    chainDescription: 'When both d8s match, leaps to another target within 30ft'
  }
};

// Detect if a spell has choosable damage types from its description
function detectDamageTypeChoice(spell) {
  const desc = (spell.description || '').toLowerCase();
  const key = spell.key?.replace(/^wikidot_|^srd_/, '') || '';

  // Check known spells first
  if (DAMAGE_TYPE_CHOICE_SPELLS[key]) {
    return {
      hasChoice: true,
      types: DAMAGE_TYPE_CHOICE_SPELLS[key],
      isRandom: false
    };
  }

  // Detect "you choose [type], [type], or [type]" patterns
  const choosePattern = /you choose (acid|cold|fire|force|lightning|necrotic|poison|psychic|radiant|thunder)(?:,\s*(acid|cold|fire|force|lightning|necrotic|poison|psychic|radiant|thunder))*(?:,?\s*or\s*(acid|cold|fire|force|lightning|necrotic|poison|psychic|radiant|thunder))/i;
  const match = desc.match(choosePattern);

  if (match) {
    const types = [];
    for (let i = 1; i < match.length; i++) {
      if (match[i]) types.push(match[i].toLowerCase());
    }
    return {
      hasChoice: types.length > 1,
      types: [...new Set(types)],
      isRandom: false
    };
  }

  // Detect Chaos Bolt style random damage
  if (desc.includes('chaos bolt') || (desc.includes('determines the') && desc.includes('damage type'))) {
    return {
      hasChoice: false,
      types: ['acid', 'cold', 'fire', 'force', 'lightning', 'poison', 'psychic', 'thunder'],
      isRandom: true
    };
  }

  return {
    hasChoice: false,
    types: spell.damageTypes || [],
    isRandom: false
  };
}

// Default combat context for analysis
const DEFAULT_CONTEXT = {
  casterLevel: 5,
  spellcastingMod: 4,    // +4 from primary stat
  proficiencyBonus: 3,
  targetAC: 15,
  targetSaves: {
    strength: 2,
    dexterity: 3,
    constitution: 3,
    intelligence: 0,
    wisdom: 1,
    charisma: -1
  },
  expectedTargets: 1,     // For AoE spells
  expectedDuration: 1,    // Rounds for concentration spells
};

// Calculate spell save DC
export function calculateSpellDC(caster) {
  return 8 + (caster.proficiencyBonus || 3) + (caster.spellcastingMod || 4);
}

// Calculate spell attack bonus
export function calculateSpellAttackBonus(caster) {
  return (caster.proficiencyBonus || 3) + (caster.spellcastingMod || 4);
}

// Calculate probability of hitting with spell attack
export function calculateSpellHitChance(caster, targetAC) {
  const attackBonus = calculateSpellAttackBonus(caster);
  const neededRoll = targetAC - attackBonus;

  // Natural 1 always misses, natural 20 always hits
  if (neededRoll <= 1) return 0.95;  // Only miss on natural 1
  if (neededRoll >= 20) return 0.05; // Only hit on natural 20

  return (21 - neededRoll) / 20;
}

// Calculate probability of target failing a save
export function calculateSaveFailChance(spellDC, targetSaveBonus) {
  const neededRoll = spellDC - targetSaveBonus;

  // Natural 1 always fails (for monsters), natural 20 always succeeds
  if (neededRoll <= 1) return 0.05;  // Only fail on natural 1
  if (neededRoll >= 20) return 0.95; // Only succeed on natural 20

  return (neededRoll - 1) / 20;
}

// Analyze a single spell
export function analyzeSpell(spell, context = {}) {
  const ctx = { ...DEFAULT_CONTEXT, ...context };
  const spellDC = calculateSpellDC(ctx);

  const analysis = {
    spell: {
      key: spell.key,
      name: spell.name,
      level: spell.level,
      school: spell.school,
      concentration: spell.concentration,
      ritual: spell.ritual
    },
    context: {
      casterLevel: ctx.casterLevel,
      spellDC,
      spellAttackBonus: calculateSpellAttackBonus(ctx)
    },
    damage: null,
    efficiency: null,
    tactical: null
  };

  // Skip non-damage spells for DPR analysis
  if (!spell.damageRoll) {
    analysis.damage = {
      hasDamage: false,
      note: 'Utility/control spell - no direct damage'
    };
    return analysis;
  }

  // Check for special damage formula overrides (spells with complex formulas the scraper may miss)
  const spellKey = spell.key?.replace(/^wikidot_|^srd_/, '') || '';
  const specialFormula = SPECIAL_DAMAGE_FORMULAS[spellKey];
  let effectiveDamageRoll = spell.damageRoll;
  let chainMechanic = null;

  if (specialFormula) {
    effectiveDamageRoll = specialFormula.baseDamage;
    if (specialFormula.chainChance) {
      chainMechanic = {
        chance: specialFormula.chainChance,
        description: specialFormula.chainDescription
      };
    }
  }

  // Parse damage
  const damageInfo = getDiceSummary(effectiveDamageRoll);
  if (!damageInfo.valid) {
    analysis.damage = {
      hasDamage: false,
      note: `Could not parse damage: ${spell.damageRoll}`
    };
    return analysis;
  }

  // Calculate hit/save probability
  let hitChance = 1;
  let saveForHalf = false;

  if (spell.attackRoll) {
    hitChance = calculateSpellHitChance(ctx, ctx.targetAC);
  } else if (spell.savingThrow) {
    const saveMod = ctx.targetSaves[spell.savingThrow.toLowerCase()] || 0;
    hitChance = calculateSaveFailChance(spellDC, saveMod);

    // Check if spell does half damage on save
    if (spell.description && spell.description.toLowerCase().includes('half as much damage')) {
      saveForHalf = true;
    }
  }

  // Calculate expected damage
  let expectedDamage = damageInfo.average * hitChance;

  // Add half damage on successful save if applicable
  if (saveForHalf) {
    expectedDamage += damageInfo.average * (1 - hitChance) * 0.5;
  }

  // Add crit damage for attack rolls (5% chance)
  if (spell.attackRoll) {
    const critDamage = damageInfo.average; // Double dice on crit
    expectedDamage += critDamage * 0.05;
  }

  // Adjust for AoE
  const targetInfo = estimateTargets(spell, ctx);
  const targets = targetInfo.targets;
  const maxTargets = targetInfo.maxTargets;
  let totalExpectedDamage = expectedDamage * targets;

  // Handle chain mechanics (like Chaos Bolt's bounce)
  // Each chain is a FULL new attack with full damage, not just bonus damage
  // Chain triggers: first hit must land (already in expectedDamage), then 12.5% chance to chain
  // Each chain = new attack roll (hitChance) for full damage (damageInfo.average)
  //
  // Expected chain damage = sum of geometric series:
  //   First chain:  chainProb × hitChance × damage
  //   Second chain: (chainProb × hitChance)² × damage
  //   ... and so on
  // = damage × pq × (1 + pq + pq² + ...) = damage × pq / (1 - pq)
  // where p = chain probability, q = hit chance
  let chainExpectedDamage = null;
  if (chainMechanic) {
    const chainProb = chainMechanic.chance;
    const pq = chainProb * hitChance;
    // Expected total damage from all chains (geometric series)
    // This is the expected damage from chains GIVEN that first attack hit
    // But we also need to factor in crit damage on chains
    const chainDamagePerHit = damageInfo.average * (1 + 0.05); // Include crit bonus
    chainExpectedDamage = pq < 1 ? chainDamagePerHit * pq / (1 - pq) : 0;
    totalExpectedDamage += chainExpectedDamage;
  }

  // Calculate sustained damage for concentration spells
  let sustainedDamage = totalExpectedDamage;
  if (spell.concentration && spell.duration) {
    const rounds = estimateDuration(spell.duration);
    sustainedDamage = totalExpectedDamage * rounds;
  }

  // Detect damage type choice options
  const damageTypeInfo = detectDamageTypeChoice(spell);

  analysis.damage = {
    hasDamage: true,
    baseDamage: specialFormula ? effectiveDamageRoll : spell.damageRoll,
    baseDamageNote: specialFormula ? `Corrected from scraped "${spell.damageRoll}"` : null,
    averageRoll: damageInfo.average,
    minimum: damageInfo.minimum,
    maximum: damageInfo.maximum,
    hitChance: Math.round(hitChance * 100),
    saveForHalf,
    expectedDamage: Math.round(expectedDamage * 100) / 100,
    targets,
    maxTargets,  // Max possible targets for this spell's AoE
    totalExpectedDamage: Math.round(totalExpectedDamage * 100) / 100,
    sustainedDamage: spell.concentration ? Math.round(sustainedDamage * 100) / 100 : null,
    // Chain mechanic info (Chaos Bolt style bouncing)
    chainMechanic: chainMechanic ? {
      ...chainMechanic,
      expectedBonusDamage: Math.round(chainExpectedDamage * 100) / 100
    } : null,
    // Damage type info - important for resistance/vulnerability optimization
    damageTypes: damageTypeInfo.types,
    damageTypeChoice: damageTypeInfo.hasChoice,  // Can caster pick the type?
    damageTypeRandom: damageTypeInfo.isRandom    // Is it randomly determined?
  };

  // Calculate efficiency metrics
  const slotLevel = Math.max(1, spell.level);
  analysis.efficiency = {
    damagePerSlotLevel: Math.round((totalExpectedDamage / slotLevel) * 100) / 100,
    damagePerAction: totalExpectedDamage,
    // Compare to baseline: Firebolt at this level
    vsCantrip: calculateCantripComparison(totalExpectedDamage, ctx.casterLevel),
    // Slot efficiency rating
    slotEfficiency: rateSlotEfficiency(totalExpectedDamage, spell.level, ctx.expectedTargets)
  };

  // Tactical notes
  analysis.tactical = generateTacticalNotes(spell, analysis.damage, ctx);

  return analysis;
}

// Calculate squares covered by AoE templates using XGtE Token Method (p.86-87)
// This uses D&D's grid distance (diagonal = orthogonal) rather than Euclidean geometry
// Templates originate from a point (corner intersection), not center of square
const AOE_SQUARES = {
  // Cones: Uses triangular number formula: 1 + 2 + 3 + ... + n where n = length/5
  // Each row widens by 1 square, matches "width equals distance from origin" rule
  // 15-foot cone: 1+2+3 = 6 squares
  // 30-foot cone: 1+2+3+4+5+6 = 21 squares (confirmed in XGtE)
  // 60-foot cone: 1+2+3+...+12 = 78 squares
  cone: {
    10: 3,    // 1+2
    15: 6,    // 1+2+3
    30: 21,   // 1+2+3+4+5+6 (XGtE explicitly states this)
    60: 78    // 1+2+...+12
  },
  // Spheres/Radius: Centered on grid intersection (point), not square
  // Extends radius/5 squares in each direction from intersection
  // 20-foot radius = 4 squares each way = 8x8 = 64 squares
  // Using ~52 for 20ft to account for circular shape (corners cut)
  sphere: {
    5: 4,     // 2x2 (1 square each way from point)
    10: 16,   // 4x4 (2 squares each way)
    15: 36,   // 6x6 (3 squares each way)
    20: 52,   // ~8x8 minus corners (Fireball - commonly cited)
    30: 120,  // ~12x12 minus corners
    40: 200   // ~16x16 minus corners
  },
  // Cubes: straightforward square grids
  // 10-foot cube: 4 squares (2x2)
  // 15-foot cube: 9 squares (3x3)
  cube: {
    5: 1,
    10: 4,
    15: 9,
    20: 16,
    30: 36
  },
  // Lines: 5 feet wide, length / 5 squares long
  line: {
    30: 6,
    60: 12,
    100: 20,
    120: 24
  },
  // Cylinders: horizontal coverage uses sphere radius rules
  cylinder: {
    5: 4,
    10: 16,
    20: 52,
    30: 120
  }
};

// Estimate expected targets based on squares covered and typical combat density
// Assumption: in typical combat, ~1 enemy per 4 squares on average (spread out)
// Clustered combat: ~1 enemy per 2 squares
function squaresToTargets(squares, clustered = false) {
  const density = clustered ? 2 : 4;
  return Math.max(1, Math.round(squares / density));
}

// Estimate number of targets for AoE spells
// Returns { targets, maxTargets } where targets is the calculated amount and maxTargets is the cap
function estimateTargets(spell, context) {
  const desc = (spell.description || '').toLowerCase();

  let maxTargets = 1;      // Maximum possible targets
  let defaultTargets = 1;  // Reasonable default given typical combat spacing

  // Parse AoE from description using regex
  // Order matters: check more specific patterns before generic ones

  // Cone patterns
  const coneMatch = desc.match(/(\d+)[- ]foot[- ]cone/);
  if (coneMatch) {
    const size = parseInt(coneMatch[1]);
    const squares = AOE_SQUARES.cone[size] || Math.round(size * size / 25);
    maxTargets = squares;  // One creature per square max
    defaultTargets = squaresToTargets(squares);
  }
  // Cylinder patterns - check BEFORE generic radius (Call Lightning, Moonbeam, Flame Strike)
  else if (desc.match(/(\d+)[- ]foot[- ]radius.{0,30}(cylinder|high)/i) ||
           desc.match(/(cylinder|column).{0,50}(\d+)[- ]foot[- ]radius/i)) {
    const cylinderMatch = desc.match(/(\d+)[- ]foot[- ]radius.{0,10}(,|\s).*?(cylinder|high)/i) ||
                          desc.match(/(cylinder|column).{0,30}(\d+)[- ]foot[- ]radius/i);
    if (cylinderMatch) {
      const size = parseInt(cylinderMatch[1]) || parseInt(cylinderMatch[2]);
      const squares = AOE_SQUARES.cylinder[size] || AOE_SQUARES.sphere[size] || 4;
      maxTargets = squares;
      defaultTargets = squaresToTargets(squares);
    }
  }
  // "to a distance of X feet" pattern (Spirit Guardians)
  else if (desc.match(/to a distance of (\d+) feet/)) {
    const match = desc.match(/to a distance of (\d+) feet/);
    const size = parseInt(match[1]);
    const squares = AOE_SQUARES.sphere[size] || Math.round((size/5 * 2) * (size/5 * 2));
    maxTargets = squares;
    defaultTargets = squaresToTargets(squares);
  }
  // Cube patterns
  else if (desc.match(/(\d+)[- ]foot[- ]cube/)) {
    const match = desc.match(/(\d+)[- ]foot[- ]cube/);
    const size = parseInt(match[1]);
    const squares = AOE_SQUARES.cube[size] || Math.round((size/5) * (size/5));
    maxTargets = squares;
    defaultTargets = squaresToTargets(squares);
  }
  // Line patterns
  else if (desc.match(/(\d+)[- ]foot[- ]line/) || desc.match(/line.+(\d+)[- ]feet? long/)) {
    const match = desc.match(/(\d+)[- ]foot/) || desc.match(/(\d+)[- ]feet/);
    if (match) {
      const size = parseInt(match[1]);
      const squares = AOE_SQUARES.line[size] || Math.round(size / 5);
      maxTargets = squares;
      defaultTargets = squaresToTargets(squares);
    }
  }
  // Generic sphere/radius patterns - LAST for AoE shapes
  // Skip if description mentions "bolt" or "strike" hitting a point (Call Lightning)
  else if (desc.match(/(\d+)[- ]foot[- ]radius/) && !desc.match(/bolt.{0,20}(flash|strike|hit)/i)) {
    const match = desc.match(/(\d+)[- ]foot[- ]radius/);
    const size = parseInt(match[1]);
    const squares = AOE_SQUARES.sphere[size] || Math.round(Math.PI * (size/5) * (size/5));
    maxTargets = squares;
    defaultTargets = squaresToTargets(squares);
  }
  // Explicit multi-target spells - check BEFORE single target
  // Chain Lightning style: "as many as three other targets" (primary + 3 = 4 total)
  else if (desc.includes('three other targets') || desc.includes('3 other targets')) {
    maxTargets = 4;
    defaultTargets = 4;
  }
  // Magic Missile style: "three glowing darts", "three rays", etc.
  else if (desc.match(/(two|three|four|five|six)\s+\w*\s*(darts?|bolts?|beams?|rays?|missiles?)/)) {
    const numWords = { two: 2, three: 3, four: 4, five: 5, six: 6 };
    const match = desc.match(/(two|three|four|five|six)\s+\w*\s*(darts?|bolts?|beams?|rays?|missiles?)/);
    if (match && numWords[match[1]]) {
      maxTargets = numWords[match[1]];
      defaultTargets = numWords[match[1]];
    }
  }
  else if (desc.includes('two creatures') || desc.includes('two targets')) {
    maxTargets = 2;
    defaultTargets = 2;
  }
  else if (desc.includes('three creatures') || desc.includes('three targets')) {
    maxTargets = 3;
    defaultTargets = 3;
  }
  else if (desc.includes('four creatures') || desc.includes('four targets')) {
    maxTargets = 4;
    defaultTargets = 4;
  }
  // Generic multi-target
  else if (desc.includes('each creature') || desc.includes('all creatures')) {
    maxTargets = 20;  // Reasonable cap for generic AoE
    defaultTargets = 2;
  }
  // Single target
  else if (desc.includes('one creature') || desc.includes('one target') ||
           desc.includes('a creature') || desc.includes('a target')) {
    maxTargets = 1;
    defaultTargets = 1;
  }

  // Use context target count if explicitly provided (> 1), otherwise use calculated default
  // expectedTargets = 1 means "use default", > 1 means "user specified this many"
  let targets = defaultTargets;
  if (context.expectedTargets > 1) {
    targets = Math.min(context.expectedTargets, maxTargets);
  }

  return { targets, maxTargets };
}

// Estimate duration in rounds
function estimateDuration(durationStr) {
  if (!durationStr) return 1;

  const dur = durationStr.toLowerCase();

  if (dur.includes('instantaneous')) return 1;
  if (dur.includes('1 round')) return 1;

  // Extract minutes
  const minuteMatch = dur.match(/(\d+)\s*minute/);
  if (minuteMatch) {
    return Math.min(parseInt(minuteMatch[1]) * 10, 100); // 10 rounds per minute, cap at 100
  }

  // Extract rounds
  const roundMatch = dur.match(/(\d+)\s*round/);
  if (roundMatch) {
    return parseInt(roundMatch[1]);
  }

  // Default for concentration
  if (dur.includes('concentration')) {
    return 10; // Assume 1 minute combat
  }

  return 1;
}

// Compare to cantrip baseline
function calculateCantripComparison(damage, casterLevel) {
  // Firebolt damage by level
  let cantripDice = 1;
  if (casterLevel >= 17) cantripDice = 4;
  else if (casterLevel >= 11) cantripDice = 3;
  else if (casterLevel >= 5) cantripDice = 2;

  const cantripDamage = cantripDice * 5.5 * 0.65; // d10 average, ~65% hit rate
  const ratio = damage / cantripDamage;

  return {
    cantripDamage: Math.round(cantripDamage * 100) / 100,
    ratio: Math.round(ratio * 100) / 100,
    worthSlot: ratio > 1.5 // Worth a slot if 50% better than cantrip
  };
}

// Rate slot efficiency
function rateSlotEfficiency(damage, spellLevel, targets) {
  // Baseline expectations per spell level (single target)
  const baselines = {
    0: 5,   // Cantrip
    1: 12,  // ~Magic Missile
    2: 18,  // ~Scorching Ray
    3: 28,  // ~Fireball (but single target baseline)
    4: 35,
    5: 45,
    6: 55,
    7: 65,
    8: 75,
    9: 90
  };

  const baseline = baselines[spellLevel] || 10;
  const ratio = damage / baseline;

  if (ratio >= 1.3) return { rating: 'excellent', score: ratio };
  if (ratio >= 1.0) return { rating: 'good', score: ratio };
  if (ratio >= 0.7) return { rating: 'average', score: ratio };
  return { rating: 'poor', score: ratio };
}

// Generate tactical notes
function generateTacticalNotes(spell, damageInfo, context) {
  const notes = [];
  const conditions = [];

  if (spell.concentration) {
    notes.push('Requires concentration - can be interrupted');
    conditions.push('maintain_concentration');
  }

  if (spell.savingThrow) {
    const saveName = spell.savingThrow.toLowerCase();
    if (saveName === 'dexterity') {
      notes.push('DEX save - less effective vs agile enemies');
      conditions.push('target_low_dex');
    } else if (saveName === 'constitution') {
      notes.push('CON save - less effective vs tough enemies');
      conditions.push('target_low_con');
    } else if (saveName === 'wisdom') {
      notes.push('WIS save - effective vs low-WIS creatures');
      conditions.push('target_low_wis');
    } else if (saveName === 'intelligence') {
      notes.push('INT save - very effective vs beasts/undead');
      conditions.push('target_low_int');
    }
  }

  if (damageInfo.targets > 1) {
    notes.push(`AoE spell - best with ${damageInfo.targets}+ clustered enemies`);
    conditions.push('multiple_targets');
  }

  if (spell.ritual) {
    notes.push('Can be cast as ritual (no slot, +10 min)');
  }

  // Check for common spell types
  const desc = (spell.description || '').toLowerCase();

  if (desc.includes('restrained') || desc.includes('paralyzed') || desc.includes('stunned')) {
    notes.push('Applies powerful condition - tactical control');
    conditions.push('control_spell');
  }

  if (desc.includes('bonus action')) {
    notes.push('Uses bonus action - good action economy');
    conditions.push('bonus_action');
  }

  return {
    notes,
    bestConditions: conditions,
    isControl: conditions.includes('control_spell'),
    isAoE: damageInfo.targets > 1
  };
}

// Compare multiple spells
export function compareSpells(spells, context = {}) {
  const analyses = spells.map(spell => analyzeSpell(spell, context));

  // Sort by expected damage
  analyses.sort((a, b) => {
    const aDmg = a.damage?.totalExpectedDamage || 0;
    const bDmg = b.damage?.totalExpectedDamage || 0;
    return bDmg - aDmg;
  });

  return {
    spells: analyses,
    bestDamage: analyses[0]?.spell.name,
    bestEfficiency: analyses
      .filter(a => a.efficiency)
      .sort((a, b) => b.efficiency.damagePerSlotLevel - a.efficiency.damagePerSlotLevel)[0]?.spell.name
  };
}

// Get best spells for a slot level
export function getBestSpellsForSlot(allSpells, slotLevel, context = {}) {
  // Filter to spells of this level or lower
  const eligible = allSpells.filter(s => s.level > 0 && s.level <= slotLevel && s.damageRoll);

  const analyses = eligible.map(spell => {
    // Upcast if lower level
    const upcastSpell = { ...spell };
    if (spell.level < slotLevel && spell.higherLevel) {
      upcastSpell.damageRoll = scaleSpellDamage(
        spell.damageRoll,
        spell.level,
        slotLevel,
        spell.higherLevel
      );
    }
    return analyzeSpell(upcastSpell, context);
  });

  // Sort by efficiency
  return analyses
    .filter(a => a.damage?.hasDamage)
    .sort((a, b) => b.efficiency.damagePerSlotLevel - a.efficiency.damagePerSlotLevel)
    .slice(0, 10);
}

// Analyze cantrip scaling
export function analyzeCantripScaling(cantrip, maxLevel = 20) {
  const tiers = [
    { level: 1, dice: 1 },
    { level: 5, dice: 2 },
    { level: 11, dice: 3 },
    { level: 17, dice: 4 }
  ];

  return tiers.map(tier => {
    const context = { casterLevel: tier.level };
    const scaledCantrip = { ...cantrip };

    // Scale damage dice
    if (cantrip.damageRoll) {
      const parsed = parseDiceExpression(cantrip.damageRoll);
      if (parsed && parsed.components.length > 0) {
        parsed.components[0].count = tier.dice;
        scaledCantrip.damageRoll = `${tier.dice}d${parsed.components[0].sides}${parsed.modifier ? '+' + parsed.modifier : ''}`;
      }
    }

    return {
      level: tier.level,
      dice: tier.dice,
      analysis: analyzeSpell(scaledCantrip, context)
    };
  });
}
