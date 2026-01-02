// Spell DPR Analyzer - Client-side spell analysis
import { calculateAverage, parseDiceExpression, scaleSpellDamage, getDiceSummary } from './dice.js';

// Spells with choosable damage types
const DAMAGE_TYPE_CHOICE_SPELLS = {
  'chromatic-orb': ['acid', 'cold', 'fire', 'lightning', 'poison', 'thunder'],
  'dragons-breath': ['acid', 'cold', 'fire', 'lightning', 'poison'],
  'elemental-bane': ['acid', 'cold', 'fire', 'lightning'],
  'elemental-weapon': ['acid', 'cold', 'fire', 'lightning', 'thunder'],
  'glyph-of-warding': ['acid', 'cold', 'fire', 'lightning', 'thunder'],
  'spirit-shroud': ['cold', 'necrotic', 'radiant'],
  'flame-blade': ['fire'],
};

// Special damage formula overrides
const SPECIAL_DAMAGE_FORMULAS = {
  'chaos-bolt': {
    baseDamage: '2d8+1d6',
    slotScaling: '1d6',
    chainChance: 0.125,
    chainDescription: 'When both d8s match, leaps to another target within 30ft'
  }
};

// Detect damage type choice from spell description
function detectDamageTypeChoice(spell) {
  const desc = (spell.description || '').toLowerCase();
  const key = spell.key?.replace(/^wikidot_|^srd_/, '') || '';

  if (DAMAGE_TYPE_CHOICE_SPELLS[key]) {
    return {
      hasChoice: true,
      types: DAMAGE_TYPE_CHOICE_SPELLS[key],
      isRandom: false
    };
  }

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

// Default combat context
const DEFAULT_CONTEXT = {
  casterLevel: 5,
  spellcastingMod: 4,
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
  expectedTargets: 1,
  expectedDuration: 1,
};

export function calculateSpellDC(caster) {
  return 8 + (caster.proficiencyBonus || 3) + (caster.spellcastingMod || 4);
}

export function calculateSpellAttackBonus(caster) {
  return (caster.proficiencyBonus || 3) + (caster.spellcastingMod || 4);
}

export function calculateSpellHitChance(caster, targetAC) {
  const attackBonus = calculateSpellAttackBonus(caster);
  const neededRoll = targetAC - attackBonus;

  if (neededRoll <= 1) return 0.95;
  if (neededRoll >= 20) return 0.05;

  return (21 - neededRoll) / 20;
}

export function calculateSaveFailChance(spellDC, targetSaveBonus) {
  const neededRoll = spellDC - targetSaveBonus;

  if (neededRoll <= 1) return 0.05;
  if (neededRoll >= 20) return 0.95;

  return (neededRoll - 1) / 20;
}

// AoE square calculations
const AOE_SQUARES = {
  cone: { 10: 3, 15: 6, 30: 21, 60: 78 },
  sphere: { 5: 4, 10: 16, 15: 36, 20: 52, 30: 120, 40: 200 },
  cube: { 5: 1, 10: 4, 15: 9, 20: 16, 30: 36 },
  line: { 30: 6, 60: 12, 100: 20, 120: 24 },
  cylinder: { 5: 4, 10: 16, 20: 52, 30: 120 }
};

function squaresToTargets(squares, clustered = false) {
  const density = clustered ? 2 : 4;
  return Math.max(1, Math.round(squares / density));
}

function estimateTargets(spell, context) {
  const desc = (spell.description || '').toLowerCase();

  let maxTargets = 1;
  let defaultTargets = 1;

  // Cone patterns
  const coneMatch = desc.match(/(\d+)[- ]foot[- ]cone/);
  if (coneMatch) {
    const size = parseInt(coneMatch[1]);
    const squares = AOE_SQUARES.cone[size] || Math.round(size * size / 25);
    maxTargets = squares;
    defaultTargets = squaresToTargets(squares);
  }
  // Cylinder patterns
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
  // Distance pattern (Spirit Guardians)
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
  // Sphere/radius patterns
  else if (desc.match(/(\d+)[- ]foot[- ]radius/) && !desc.match(/bolt.{0,20}(flash|strike|hit)/i)) {
    const match = desc.match(/(\d+)[- ]foot[- ]radius/);
    const size = parseInt(match[1]);
    const squares = AOE_SQUARES.sphere[size] || Math.round(Math.PI * (size/5) * (size/5));
    maxTargets = squares;
    defaultTargets = squaresToTargets(squares);
  }
  // Multi-target spells
  else if (desc.includes('three other targets') || desc.includes('3 other targets')) {
    maxTargets = 4;
    defaultTargets = 4;
  }
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
  else if (desc.includes('each creature') || desc.includes('all creatures')) {
    maxTargets = 20;
    defaultTargets = 2;
  }
  else if (desc.includes('one creature') || desc.includes('one target') ||
           desc.includes('a creature') || desc.includes('a target')) {
    maxTargets = 1;
    defaultTargets = 1;
  }

  let targets = defaultTargets;
  if (context.expectedTargets > 1) {
    targets = Math.min(context.expectedTargets, maxTargets);
  }

  return { targets, maxTargets };
}

function estimateDuration(durationStr) {
  if (!durationStr) return 1;

  const dur = durationStr.toLowerCase();

  if (dur.includes('instantaneous')) return 1;
  if (dur.includes('1 round')) return 1;

  const minuteMatch = dur.match(/(\d+)\s*minute/);
  if (minuteMatch) {
    return Math.min(parseInt(minuteMatch[1]) * 10, 100);
  }

  const roundMatch = dur.match(/(\d+)\s*round/);
  if (roundMatch) {
    return parseInt(roundMatch[1]);
  }

  if (dur.includes('concentration')) {
    return 10;
  }

  return 1;
}

function calculateCantripComparison(damage, casterLevel) {
  let cantripDice = 1;
  if (casterLevel >= 17) cantripDice = 4;
  else if (casterLevel >= 11) cantripDice = 3;
  else if (casterLevel >= 5) cantripDice = 2;

  const cantripDamage = cantripDice * 5.5 * 0.65;
  const ratio = damage / cantripDamage;

  return {
    cantripDamage: Math.round(cantripDamage * 100) / 100,
    ratio: Math.round(ratio * 100) / 100,
    worthSlot: ratio > 1.5
  };
}

function rateSlotEfficiency(damage, spellLevel, targets) {
  const baselines = {
    0: 5, 1: 12, 2: 18, 3: 28, 4: 35, 5: 45, 6: 55, 7: 65, 8: 75, 9: 90
  };

  const baseline = baselines[spellLevel] || 10;
  const ratio = damage / baseline;

  if (ratio >= 1.3) return { rating: 'excellent', score: ratio };
  if (ratio >= 1.0) return { rating: 'good', score: ratio };
  if (ratio >= 0.7) return { rating: 'average', score: ratio };
  return { rating: 'poor', score: ratio };
}

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

// Main spell analysis function
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

  if (!spell.damageRoll) {
    analysis.damage = {
      hasDamage: false,
      note: 'Utility/control spell - no direct damage'
    };
    return analysis;
  }

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

  const damageInfo = getDiceSummary(effectiveDamageRoll);
  if (!damageInfo.valid) {
    analysis.damage = {
      hasDamage: false,
      note: `Could not parse damage: ${spell.damageRoll}`
    };
    return analysis;
  }

  let hitChance = 1;
  let saveForHalf = false;

  if (spell.attackRoll) {
    hitChance = calculateSpellHitChance(ctx, ctx.targetAC);
  } else if (spell.savingThrow) {
    const saveMod = ctx.targetSaves[spell.savingThrow.toLowerCase()] || 0;
    hitChance = calculateSaveFailChance(spellDC, saveMod);

    if (spell.description && spell.description.toLowerCase().includes('half as much damage')) {
      saveForHalf = true;
    }
  }

  let expectedDamage = damageInfo.average * hitChance;

  if (saveForHalf) {
    expectedDamage += damageInfo.average * (1 - hitChance) * 0.5;
  }

  if (spell.attackRoll) {
    const critDamage = damageInfo.average;
    expectedDamage += critDamage * 0.05;
  }

  const targetInfo = estimateTargets(spell, ctx);
  const targets = targetInfo.targets;
  const maxTargets = targetInfo.maxTargets;
  let totalExpectedDamage = expectedDamage * targets;

  let chainExpectedDamage = null;
  if (chainMechanic) {
    const chainProb = chainMechanic.chance;
    const pq = chainProb * hitChance;
    const chainDamagePerHit = damageInfo.average * (1 + 0.05);
    chainExpectedDamage = pq < 1 ? chainDamagePerHit * pq / (1 - pq) : 0;
    totalExpectedDamage += chainExpectedDamage;
  }

  let sustainedDamage = totalExpectedDamage;
  if (spell.concentration && spell.duration) {
    const rounds = estimateDuration(spell.duration);
    sustainedDamage = totalExpectedDamage * rounds;
  }

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
    maxTargets,
    totalExpectedDamage: Math.round(totalExpectedDamage * 100) / 100,
    sustainedDamage: spell.concentration ? Math.round(sustainedDamage * 100) / 100 : null,
    chainMechanic: chainMechanic ? {
      ...chainMechanic,
      expectedBonusDamage: Math.round(chainExpectedDamage * 100) / 100
    } : null,
    damageTypes: damageTypeInfo.types,
    damageTypeChoice: damageTypeInfo.hasChoice,
    damageTypeRandom: damageTypeInfo.isRandom
  };

  const slotLevel = Math.max(1, spell.level);
  analysis.efficiency = {
    damagePerSlotLevel: Math.round((totalExpectedDamage / slotLevel) * 100) / 100,
    damagePerAction: totalExpectedDamage,
    vsCantrip: calculateCantripComparison(totalExpectedDamage, ctx.casterLevel),
    slotEfficiency: rateSlotEfficiency(totalExpectedDamage, spell.level, ctx.expectedTargets)
  };

  analysis.tactical = generateTacticalNotes(spell, analysis.damage, ctx);

  return analysis;
}

// Compare multiple spells
export function compareSpells(spells, context = {}) {
  const analyses = spells.map(spell => analyzeSpell(spell, context));

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
  const eligible = allSpells.filter(s => s.level > 0 && s.level <= slotLevel && s.damageRoll);

  const analyses = eligible.map(spell => {
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
