// Cheat Sheet Generator - Creates printable reference cards

export function generateCheatSheet(character, breakpoints) {
  const {
    name = "Character",
    class: charClass,
    level,
    feats = [],
  } = character;

  const sections = [];

  // Header
  sections.push({
    type: 'header',
    content: `${name} - Level ${level} ${charClass}`,
  });

  // Quick Reference Stats
  sections.push({
    type: 'stats',
    title: 'Combat Stats',
    items: [
      `Attack Bonus: +${character.attackBonus}`,
      `Base Damage: ${character.baseDamage}`,
      `AC: ${character.ac}`,
    ],
  });

  // GWM/Sharpshooter section
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

  // Class-specific sections
  if (charClass?.toLowerCase() === 'barbarian') {
    sections.push({
      type: 'decision',
      title: 'Reckless Attack',
      rules: [
        {
          condition: 'High HP, few enemies, have resistance',
          action: 'USE Reckless',
          priority: 'high',
        },
        {
          condition: 'Low HP or many enemies',
          action: 'SKIP Reckless',
          priority: 'low',
        },
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
        {
          condition: 'vs. Casters/Rogues (low CON)',
          action: 'WORTH IT - attempt stun',
          priority: 'high',
        },
        {
          condition: 'vs. Warriors (average CON)',
          action: 'Use on high-priority targets only',
          priority: 'medium',
        },
        {
          condition: 'vs. Brutes/Giants (high CON)',
          action: 'SAVE YOUR KI',
          priority: 'low',
        },
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
        {
          condition: 'You rolled a CRIT',
          action: 'ALWAYS SMITE (double dice!)',
          priority: 'high',
        },
        {
          condition: 'Target is almost dead',
          action: 'Smite to secure kill',
          priority: 'medium',
        },
        {
          condition: 'Normal hit, target healthy',
          action: 'Save slots for crits',
          priority: 'low',
        },
      ],
      notes: [
        '1st: 2d8 (9 avg) | 2nd: 3d8 (13.5 avg)',
        '3rd: 4d8 (18 avg) | 4th: 5d8 (22.5 avg)',
        '+1d8 vs undead/fiends',
        'Crits DOUBLE all smite dice!',
      ],
    });
  }

  // Generic combat tips
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

  // Action Economy reminder
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
      pageSize: 'card', // 4x6 or index card size
      fontSize: 'small',
      columns: 1,
    },
  };
}
