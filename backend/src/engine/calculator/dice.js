// Dice expression parser and calculator
// Handles expressions like: 2d6, 3d8+5, 1d10+2d6+3, 4d6kh3 (keep highest 3)

// Parse a dice expression into components
export function parseDiceExpression(expression) {
  if (!expression || typeof expression !== 'string') {
    return null;
  }

  // Normalize the expression
  const normalized = expression.toLowerCase().replace(/\s+/g, '');

  // Match dice rolls and modifiers
  // Pattern: XdY (optional: kh/kl for keep highest/lowest)
  const dicePattern = /(\d+)?d(\d+)(?:k([hl])(\d+))?/g;
  const modifierPattern = /([+-])(\d+)(?![d])/g;

  const components = [];
  let match;

  // Extract dice components
  while ((match = dicePattern.exec(normalized)) !== null) {
    components.push({
      type: 'dice',
      count: parseInt(match[1] || '1'),
      sides: parseInt(match[2]),
      keep: match[3] ? {
        type: match[3] === 'h' ? 'highest' : 'lowest',
        count: parseInt(match[4])
      } : null
    });
  }

  // Extract flat modifiers
  let modifier = 0;
  const modifierMatches = normalized.match(modifierPattern);
  if (modifierMatches) {
    for (const mod of modifierMatches) {
      modifier += parseInt(mod);
    }
  }

  // Check for leading modifier (e.g., "5+2d6")
  const leadingModifier = normalized.match(/^(\d+)(?=[+-])/);
  if (leadingModifier) {
    modifier += parseInt(leadingModifier[1]);
  }

  if (components.length === 0 && modifier === 0) {
    // Try to parse as just a number
    const num = parseInt(normalized);
    if (!isNaN(num)) {
      return {
        components: [],
        modifier: num,
        original: expression
      };
    }
    return null;
  }

  return {
    components,
    modifier,
    original: expression
  };
}

// Calculate the average (expected value) of a dice expression
export function calculateAverage(expression) {
  const parsed = typeof expression === 'string'
    ? parseDiceExpression(expression)
    : expression;

  if (!parsed) return 0;

  let total = parsed.modifier;

  for (const component of parsed.components) {
    if (component.type === 'dice') {
      const dieAverage = (component.sides + 1) / 2;

      if (component.keep) {
        // For keep highest/lowest, use approximation
        // This is a simplified calculation
        total += calculateKeepAverage(component.count, component.sides, component.keep);
      } else {
        total += component.count * dieAverage;
      }
    }
  }

  return total;
}

// Calculate expected value for keep highest/lowest rolls
function calculateKeepAverage(count, sides, keep) {
  // For common cases, use precalculated values
  // 4d6 keep highest 3 (standard array generation)
  if (count === 4 && sides === 6 && keep.type === 'highest' && keep.count === 3) {
    return 12.24; // Precalculated expected value
  }

  // For 2d20 keep highest (advantage)
  if (count === 2 && sides === 20 && keep.type === 'highest' && keep.count === 1) {
    return 13.825; // Expected value with advantage
  }

  // For 2d20 keep lowest (disadvantage)
  if (count === 2 && sides === 20 && keep.type === 'lowest' && keep.count === 1) {
    return 7.175; // Expected value with disadvantage
  }

  // Generic approximation using order statistics
  // For keeping k highest of n dice with s sides:
  // E[X(k)] ≈ (s+1) * (n-k+1)/(n+1) for highest
  const n = count;
  const s = sides;
  const k = keep.count;

  if (keep.type === 'highest') {
    // Sum of k highest out of n
    let sum = 0;
    for (let i = 0; i < k; i++) {
      // Order statistic approximation
      const rank = n - i;
      sum += (s + 1) * rank / (n + 1);
    }
    return sum;
  } else {
    // Sum of k lowest out of n
    let sum = 0;
    for (let i = 0; i < k; i++) {
      const rank = i + 1;
      sum += (s + 1) * rank / (n + 1);
    }
    return sum;
  }
}

// Calculate minimum possible roll
export function calculateMinimum(expression) {
  const parsed = typeof expression === 'string'
    ? parseDiceExpression(expression)
    : expression;

  if (!parsed) return 0;

  let total = parsed.modifier;

  for (const component of parsed.components) {
    if (component.type === 'dice') {
      const diceToCount = component.keep ? component.keep.count : component.count;
      total += diceToCount; // Minimum is 1 per die
    }
  }

  return total;
}

// Calculate maximum possible roll
export function calculateMaximum(expression) {
  const parsed = typeof expression === 'string'
    ? parseDiceExpression(expression)
    : expression;

  if (!parsed) return 0;

  let total = parsed.modifier;

  for (const component of parsed.components) {
    if (component.type === 'dice') {
      const diceToCount = component.keep ? component.keep.count : component.count;
      total += diceToCount * component.sides;
    }
  }

  return total;
}

// Roll dice (for simulation)
export function rollDice(expression) {
  const parsed = typeof expression === 'string'
    ? parseDiceExpression(expression)
    : expression;

  if (!parsed) return 0;

  let total = parsed.modifier;

  for (const component of parsed.components) {
    if (component.type === 'dice') {
      const rolls = [];
      for (let i = 0; i < component.count; i++) {
        rolls.push(Math.floor(Math.random() * component.sides) + 1);
      }

      if (component.keep) {
        rolls.sort((a, b) => b - a); // Sort descending
        const kept = component.keep.type === 'highest'
          ? rolls.slice(0, component.keep.count)
          : rolls.slice(-component.keep.count);
        total += kept.reduce((sum, r) => sum + r, 0);
      } else {
        total += rolls.reduce((sum, r) => sum + r, 0);
      }
    }
  }

  return total;
}

// Get a summary of a dice expression
export function getDiceSummary(expression) {
  const parsed = parseDiceExpression(expression);
  if (!parsed) {
    return {
      valid: false,
      original: expression
    };
  }

  return {
    valid: true,
    original: expression,
    average: calculateAverage(parsed),
    minimum: calculateMinimum(parsed),
    maximum: calculateMaximum(parsed),
    components: parsed.components,
    modifier: parsed.modifier
  };
}

// Format dice expression for display
export function formatDiceExpression(parsed) {
  if (!parsed) return '';

  const parts = [];

  for (const component of parsed.components) {
    if (component.type === 'dice') {
      let str = `${component.count}d${component.sides}`;
      if (component.keep) {
        str += `k${component.keep.type === 'highest' ? 'h' : 'l'}${component.keep.count}`;
      }
      parts.push(str);
    }
  }

  let result = parts.join('+');

  if (parsed.modifier > 0) {
    result += `+${parsed.modifier}`;
  } else if (parsed.modifier < 0) {
    result += parsed.modifier;
  }

  return result;
}

// Parse and scale a damage expression for higher levels
export function scaleSpellDamage(baseDamage, baseLevel, castLevel, scalingRule) {
  if (!scalingRule || !baseDamage) {
    return baseDamage;
  }

  const parsed = parseDiceExpression(baseDamage);
  if (!parsed || parsed.components.length === 0) {
    return baseDamage;
  }

  const levelDiff = castLevel - baseLevel;
  if (levelDiff <= 0) {
    return baseDamage;
  }

  // Most common scaling: add XdY per level
  // Try to extract the scaling dice from the rule text
  const scalingMatch = scalingRule.match(/(\d+)?d(\d+)/);
  if (scalingMatch) {
    const scalingCount = parseInt(scalingMatch[1] || '1');
    const scalingSides = parseInt(scalingMatch[2]);

    // Add scaling dice
    const newComponents = [...parsed.components];
    const existingDie = newComponents.find(c => c.sides === scalingSides);

    if (existingDie) {
      existingDie.count += scalingCount * levelDiff;
    } else {
      newComponents.push({
        type: 'dice',
        count: scalingCount * levelDiff,
        sides: scalingSides,
        keep: null
      });
    }

    return formatDiceExpression({
      components: newComponents,
      modifier: parsed.modifier
    });
  }

  return baseDamage;
}
