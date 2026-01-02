// D&D 5e Combat Math Engine

// Calculate to-hit probability
export function hitProbability(attackBonus, targetAC, advantage = false, disadvantage = false) {
  const needed = targetAC - attackBonus;
  let baseProb;

  if (needed <= 1) {
    baseProb = 0.95; // Natural 1 always misses
  } else if (needed >= 20) {
    baseProb = 0.05; // Natural 20 always hits
  } else {
    baseProb = (21 - needed) / 20;
  }

  if (advantage && !disadvantage) {
    return 1 - (1 - baseProb) * (1 - baseProb);
  } else if (disadvantage && !advantage) {
    return baseProb * baseProb;
  }
  return baseProb;
}

// Calculate crit probability
export function critProbability(critRange = 20, advantage = false, disadvantage = false) {
  const critChance = (21 - critRange) / 20;

  if (advantage && !disadvantage) {
    return 1 - (1 - critChance) * (1 - critChance);
  } else if (disadvantage && !advantage) {
    return critChance * critChance;
  }
  return critChance;
}

// Calculate expected damage for a single attack
export function expectedDamage(attackBonus, targetAC, baseDamage, options = {}) {
  const {
    advantage = false,
    disadvantage = false,
    critRange = 20,
    critDice = 0,
    bonusCritDamage = 0,
  } = options;

  const hitProb = hitProbability(attackBonus, targetAC, advantage, disadvantage);
  const critProb = critProbability(critRange, advantage, disadvantage);
  const normalHitProb = hitProb - critProb;

  const normalDamage = normalHitProb * baseDamage;
  const critDamage = critProb * (baseDamage * 1.5 + critDice * 3.5 + bonusCritDamage);

  return normalDamage + critDamage;
}

// GWM/Sharpshooter analysis
export function gwmBreakpoint(attackBonus, baseDamage, options = {}) {
  const results = [];

  for (let ac = 10; ac <= 25; ac++) {
    const normalDPR = expectedDamage(attackBonus, ac, baseDamage, options);
    const gwmDPR = expectedDamage(attackBonus - 5, ac, baseDamage + 10, options);

    results.push({
      ac,
      normalDPR: Math.round(normalDPR * 100) / 100,
      gwmDPR: Math.round(gwmDPR * 100) / 100,
      useGWM: gwmDPR > normalDPR,
      difference: Math.round((gwmDPR - normalDPR) * 100) / 100,
    });
  }

  const breakpoint = results.filter(r => r.useGWM).pop()?.ac || 0;

  return { results, breakpoint };
}

// Reckless Attack analysis
export function recklessBreakpoint(attackBonus, baseDamage, playerAC, expectedEnemyDamage, options = {}) {
  const results = [];

  for (let ac = 10; ac <= 25; ac++) {
    const normalDPR = expectedDamage(attackBonus, ac, baseDamage, { ...options, advantage: false });
    const recklessDPR = expectedDamage(attackBonus, ac, baseDamage, { ...options, advantage: true });
    const extraDamageTaken = expectedEnemyDamage * 0.25;
    const netBenefit = recklessDPR - normalDPR - extraDamageTaken;

    results.push({
      ac,
      normalDPR: Math.round(normalDPR * 100) / 100,
      recklessDPR: Math.round(recklessDPR * 100) / 100,
      extraDamageTaken: Math.round(extraDamageTaken * 100) / 100,
      netBenefit: Math.round(netBenefit * 100) / 100,
      useReckless: netBenefit > 0,
    });
  }

  return { results };
}

// Stunning Strike analysis (Monk)
export function stunningStrikeValue(monkLevel, wisdomMod, targetConSave, remainingKi) {
  const dc = 8 + Math.ceil(monkLevel / 4) + 1 + wisdomMod;
  const targetBonus = targetConSave;
  const failProb = Math.max(0.05, Math.min(0.95, (dc - targetBonus - 1) / 20));
  const stunValue = 20;
  const expectedValue = failProb * stunValue;
  const kiValue = 10 / Math.max(1, remainingKi);

  return {
    dc,
    failProbability: Math.round(failProb * 100),
    recommendUse: expectedValue > kiValue,
    reasoning: failProb < 0.25
      ? "Low success chance - save your ki"
      : failProb < 0.5
        ? "Moderate chance - use if target is high priority"
        : "Good chance - worth attempting",
  };
}

// Divine Smite decision
export function divineSmiteAnalysis(paladinLevel, remainingSlots, targetCurrentHP, targetMaxHP, isCrit) {
  const slots = remainingSlots;
  const totalSlots = Math.floor(paladinLevel / 2) + 2;
  const smiteDamage = [9, 13.5, 18, 22.5];
  const recommendations = [];

  for (let level = 1; level <= Math.min(4, slots.length); level++) {
    if (slots[level - 1] <= 0) continue;

    let damage = smiteDamage[level - 1] || smiteDamage[0];
    if (isCrit) damage *= 2;

    const canKill = targetCurrentHP <= damage;
    const slotScarcity = slots[level - 1] / totalSlots;

    recommendations.push({
      slotLevel: level,
      expectedDamage: Math.round(damage * 10) / 10,
      canKill,
      recommendation: isCrit
        ? "Always smite on crits!"
        : canKill
          ? "Smite to secure the kill"
          : slotScarcity < 0.3
            ? "Conserve slots - target isn't critical"
            : "Smite if target is high priority",
    });
  }

  return {
    isCrit,
    recommendations,
    generalAdvice: isCrit
      ? "SMITE! Crits double your smite dice."
      : targetCurrentHP / targetMaxHP < 0.25
        ? "Target is low - smite to finish them"
        : "Consider saving slots for crits unless this target must die now",
  };
}

// Spell slot pacing
export function spellSlotPacing(casterLevel, currentSlots, expectedEncounters) {
  const shortRests = Math.floor(expectedEncounters / 3);
  const totalSlots = currentSlots.reduce((a, b) => a + b, 0);
  const slotsPerEncounter = totalSlots / expectedEncounters;

  const recommendations = [];

  if (slotsPerEncounter < 1) {
    recommendations.push("Conserve heavily - rely on cantrips for most encounters");
    recommendations.push("Save leveled spells for emergencies or boss fights");
  } else if (slotsPerEncounter < 2) {
    recommendations.push("Use one leveled spell per encounter on average");
    recommendations.push("Save high-level slots for difficult fights");
  } else {
    recommendations.push("You have slots to spare - don't be afraid to use them");
    recommendations.push("Lead with strong spells to end fights quickly");
  }

  return {
    totalSlots,
    expectedEncounters,
    slotsPerEncounter: Math.round(slotsPerEncounter * 10) / 10,
    shortRestsExpected: shortRests,
    recommendations,
  };
}

// Main optimization function
export function calculateBreakpoints(character) {
  const {
    name = "Character",
    class: charClass,
    level,
    attackBonus,
    baseDamage,
    ac: playerAC,
    feats = [],
    stats = {},
    resources = {},
  } = character;

  const results = {
    character: { name, class: charClass, level },
    breakpoints: {},
    recommendations: [],
  };

  // GWM/Sharpshooter analysis
  if (feats.includes('GWM') || feats.includes('Sharpshooter')) {
    const featName = feats.includes('GWM') ? 'GWM' : 'Sharpshooter';
    const gwmResults = gwmBreakpoint(attackBonus, baseDamage, { advantage: false });
    const gwmAdvResults = gwmBreakpoint(attackBonus, baseDamage, { advantage: true });

    results.breakpoints[featName] = {
      normal: {
        breakpoint: gwmResults.breakpoint,
        advice: `Use ${featName} against AC ${gwmResults.breakpoint} or lower`,
        details: gwmResults.results,
      },
      withAdvantage: {
        breakpoint: gwmAdvResults.breakpoint,
        advice: `With advantage: use ${featName} against AC ${gwmAdvResults.breakpoint} or lower`,
        details: gwmAdvResults.results,
      },
    };

    results.recommendations.push(
      `${featName}: Always use vs AC ≤${Math.min(gwmResults.breakpoint, gwmAdvResults.breakpoint)}`,
      `${featName}: Never use vs AC ≥${Math.max(gwmResults.breakpoint, gwmAdvResults.breakpoint) + 3}`,
      `${featName}: With advantage, threshold increases by ~${gwmAdvResults.breakpoint - gwmResults.breakpoint} AC`
    );
  }

  // Reckless Attack (Barbarian)
  if (charClass?.toLowerCase() === 'barbarian') {
    const recklessResults = recklessBreakpoint(
      attackBonus,
      baseDamage,
      playerAC,
      resources.expectedEnemyDamage || 10
    );

    results.breakpoints.recklessAttack = recklessResults;
    results.recommendations.push(
      "Reckless Attack: Best when you have high HP and resistance",
      "Reckless Attack: Avoid when facing many enemies or low HP"
    );
  }

  // Stunning Strike (Monk)
  if (charClass?.toLowerCase() === 'monk') {
    results.breakpoints.stunningStrike = {
      vsBadCon: stunningStrikeValue(level, stats.wisdom || 3, 0, resources.ki || 5),
      vsAverageCon: stunningStrikeValue(level, stats.wisdom || 3, 3, resources.ki || 5),
      vsGoodCon: stunningStrikeValue(level, stats.wisdom || 3, 6, resources.ki || 5),
    };
    results.recommendations.push(
      "Stunning Strike: Target low-CON enemies (casters, rogues)",
      "Stunning Strike: Save ki vs high-CON brutes"
    );
  }

  // Divine Smite (Paladin)
  if (charClass?.toLowerCase() === 'paladin') {
    results.breakpoints.divineSmite = {
      onCrit: divineSmiteAnalysis(level, resources.spellSlots || [2, 2], 50, 100, true),
      onHit: divineSmiteAnalysis(level, resources.spellSlots || [2, 2], 50, 100, false),
    };
    results.recommendations.push(
      "Divine Smite: Always smite on critical hits",
      "Divine Smite: Save slots for crits unless you need to secure a kill"
    );
  }

  // Spell slot pacing (any caster)
  if (resources.spellSlots) {
    results.spellPacing = spellSlotPacing(
      level,
      resources.spellSlots,
      resources.expectedEncounters || 4
    );
  }

  return results;
}

// Generate cheat sheet
export function generateCheatSheet(character, breakpoints) {
  const {
    name = "Character",
    class: charClass,
    level,
    feats = [],
  } = character;

  const sections = [];

  sections.push({
    type: 'header',
    content: `${name} - Level ${level} ${charClass}`,
  });

  sections.push({
    type: 'stats',
    title: 'Combat Stats',
    items: [
      `Attack Bonus: +${character.attackBonus}`,
      `Base Damage: ${character.baseDamage}`,
      `AC: ${character.ac}`,
    ],
  });

  const powerAttackFeat = feats.find(f => f === 'GWM' || f === 'Sharpshooter');
  if (powerAttackFeat && breakpoints.breakpoints[powerAttackFeat]) {
    const bp = breakpoints.breakpoints[powerAttackFeat];
    sections.push({
      type: 'decision',
      title: `${powerAttackFeat} (-5/+10)`,
      rules: [
        {
          condition: `AC ≤ ${bp.normal.breakpoint - 2}`,
          action: 'ALWAYS use',
          priority: 'high',
        },
        {
          condition: `AC ${bp.normal.breakpoint - 1}-${bp.normal.breakpoint + 1}`,
          action: 'Use with advantage only',
          priority: 'medium',
        },
        {
          condition: `AC ≥ ${bp.normal.breakpoint + 2}`,
          action: 'DO NOT use',
          priority: 'low',
        },
      ],
      modifiers: [
        'Bless active: +2 to AC thresholds',
        'Advantage: +3 to AC thresholds',
        'Disadvantage: -4 to AC thresholds',
      ],
    });
  }

  if (charClass?.toLowerCase() === 'barbarian') {
    sections.push({
      type: 'decision',
      title: 'Reckless Attack',
      rules: [
        { condition: 'High HP, few enemies, have resistance', action: 'USE Reckless', priority: 'high' },
        { condition: 'Low HP or many enemies', action: 'SKIP Reckless', priority: 'low' },
      ],
      notes: [
        'Gives YOU advantage',
        'Gives ENEMIES advantage against you',
        'Best value when Rage is active (resistance)',
      ],
    });
  }

  if (charClass?.toLowerCase() === 'monk') {
    const ss = breakpoints.breakpoints.stunningStrike;
    sections.push({
      type: 'decision',
      title: 'Stunning Strike',
      rules: [
        { condition: 'vs. Casters/Rogues (low CON)', action: 'WORTH IT - attempt stun', priority: 'high' },
        { condition: 'vs. Warriors (average CON)', action: 'Use on high-priority targets only', priority: 'medium' },
        { condition: 'vs. Brutes/Giants (high CON)', action: 'SAVE YOUR KI', priority: 'low' },
      ],
      notes: [
        `Your DC: ${ss?.vsAverageCon?.dc || 8 + Math.ceil(level/4) + 1 + 3}`,
        'Stunned = incapacitated, auto-fail STR/DEX saves, attacks have advantage',
        'Ki is precious - don\'t waste on unlikely stuns',
      ],
    });
  }

  if (charClass?.toLowerCase() === 'paladin') {
    sections.push({
      type: 'decision',
      title: 'Divine Smite',
      rules: [
        { condition: 'You rolled a CRIT', action: 'ALWAYS SMITE (double dice!)', priority: 'high' },
        { condition: 'Target is almost dead', action: 'Smite to secure kill', priority: 'medium' },
        { condition: 'Normal hit, target healthy', action: 'Save slots for crits', priority: 'low' },
      ],
      notes: [
        '1st: 2d8 (9 avg) | 2nd: 3d8 (13.5 avg)',
        '3rd: 4d8 (18 avg) | 4th: 5d8 (22.5 avg)',
        '+1d8 vs undead/fiends',
        'Crits DOUBLE all smite dice!',
      ],
    });
  }

  sections.push({
    type: 'tips',
    title: 'Combat Priority',
    items: [
      '1. Eliminate enemy casters first (concentration)',
      '2. Focus fire - dead enemies deal no damage',
      '3. Control > Damage when outnumbered',
      '4. Save resources for hard fights',
    ],
  });

  sections.push({
    type: 'reference',
    title: 'Action Economy',
    items: [
      'Action: Attack, Cast, Dash, Dodge, Help, Hide',
      'Bonus Action: Class features, some spells',
      'Reaction: Opportunity Attack, Shield, Counterspell',
      'Free: Drop item, speak briefly',
    ],
  });

  return {
    character: { name, class: charClass, level },
    sections,
    printStyles: {
      pageSize: 'card',
      fontSize: 'small',
      columns: 1,
    },
  };
}
