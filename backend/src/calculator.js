// D&D 5e Combat Math Engine

// Calculate to-hit probability
function hitProbability(attackBonus, targetAC, advantage = false, disadvantage = false) {
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
function critProbability(critRange = 20, advantage = false, disadvantage = false) {
  const critChance = (21 - critRange) / 20;

  if (advantage && !disadvantage) {
    return 1 - (1 - critChance) * (1 - critChance);
  } else if (disadvantage && !advantage) {
    return critChance * critChance;
  }
  return critChance;
}

// Calculate expected damage for a single attack
function expectedDamage(attackBonus, targetAC, baseDamage, options = {}) {
  const {
    advantage = false,
    disadvantage = false,
    critRange = 20,
    critDice = 0, // Extra dice on crit (like brutal critical)
    bonusCritDamage = 0,
  } = options;

  const hitProb = hitProbability(attackBonus, targetAC, advantage, disadvantage);
  const critProb = critProbability(critRange, advantage, disadvantage);
  const normalHitProb = hitProb - critProb;

  // Normal hit damage
  const normalDamage = normalHitProb * baseDamage;

  // Crit damage (double dice + flat damage + extra crit dice)
  // Simplified: assume base damage is roughly half dice, so crit adds ~50% more
  const critDamage = critProb * (baseDamage * 1.5 + critDice * 3.5 + bonusCritDamage);

  return normalDamage + critDamage;
}

// GWM/Sharpshooter analysis
function gwmBreakpoint(attackBonus, baseDamage, options = {}) {
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

  // Find the breakpoint (highest AC where GWM is still worth it)
  const breakpoint = results.filter(r => r.useGWM).pop()?.ac || 0;

  return { results, breakpoint };
}

// Reckless Attack analysis
function recklessBreakpoint(attackBonus, baseDamage, playerAC, expectedEnemyDamage, options = {}) {
  const results = [];

  for (let ac = 10; ac <= 25; ac++) {
    // Normal attack
    const normalDPR = expectedDamage(attackBonus, ac, baseDamage, { ...options, advantage: false });

    // Reckless (advantage for you, advantage against you)
    const recklessDPR = expectedDamage(attackBonus, ac, baseDamage, { ...options, advantage: true });

    // Estimate extra damage taken (enemies have advantage)
    // Rough estimate: advantage adds ~25% to hit chance
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
function stunningStrikeValue(monkLevel, wisdomMod, targetConSave, remainingKi) {
  const dc = 8 + Math.ceil(monkLevel / 4) + 1 + wisdomMod; // Proficiency scaling simplified
  const targetBonus = targetConSave;

  // Probability target fails the save
  const failProb = Math.max(0.05, Math.min(0.95, (dc - targetBonus - 1) / 20));

  // Value of stunning (very high - lose all actions, auto-crit on melee, etc)
  // Simplified to "worth about 2 rounds of your damage"
  const stunValue = 20; // Abstract value units

  const expectedValue = failProb * stunValue;
  const kiValue = 10 / Math.max(1, remainingKi); // Ki becomes more valuable as you run low

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
function divineSmiteAnalysis(paladinLevel, remainingSlots, targetCurrentHP, targetMaxHP, isCrit) {
  const slots = remainingSlots;
  const totalSlots = Math.floor(paladinLevel / 2) + 2; // Rough approximation

  // Smite damage by slot level (2d8, 3d8, 4d8, 5d8)
  const smiteDamage = [9, 13.5, 18, 22.5]; // Average damage

  const recommendations = [];

  // Check each available slot
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
function spellSlotPacing(casterLevel, currentSlots, expectedEncounters) {
  // Standard adventuring day assumptions
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
    const gwmResults = gwmBreakpoint(attackBonus, baseDamage, {
      advantage: false,
    });
    const gwmAdvResults = gwmBreakpoint(attackBonus, baseDamage, {
      advantage: true,
    });

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
