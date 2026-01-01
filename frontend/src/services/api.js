const API_BASE = 'http://localhost:3001/api';

// Generic fetch wrapper with error handling
async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Health check
export function checkHealth() {
  return fetchApi('/health');
}

// Sync API
export function getSyncStatus(system = 'dnd5e-2014') {
  return fetchApi(`/sync/${system}/status`);
}

export function syncData(system = 'dnd5e-2014', resource = null) {
  const endpoint = resource
    ? `/sync/${system}/${resource}`
    : `/sync/${system}`;
  return fetchApi(endpoint, { method: 'POST' });
}

// Spell API
export function getSpells(system = 'dnd5e-2014', params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, value);
    }
  });

  const query = searchParams.toString();
  return fetchApi(`/${system}/spells${query ? `?${query}` : ''}`);
}

export function getSpell(system = 'dnd5e-2014', key) {
  return fetchApi(`/${system}/spells/${key}`);
}

export function getSpellStats(system = 'dnd5e-2014') {
  return fetchApi(`/${system}/spells/stats`);
}

export function searchSpells(system = 'dnd5e-2014', query, limit = 20) {
  return fetchApi(`/${system}/spells/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}

export function analyzeSpell(system = 'dnd5e-2014', key, context = {}) {
  const params = new URLSearchParams();

  if (context.casterLevel) params.append('casterLevel', context.casterLevel);
  if (context.spellMod) params.append('spellMod', context.spellMod);
  if (context.profBonus) params.append('profBonus', context.profBonus);
  if (context.targetAC) params.append('targetAC', context.targetAC);
  if (context.targets) params.append('targets', context.targets);
  if (context.targetSaves) params.append('targetSaves', JSON.stringify(context.targetSaves));

  const query = params.toString();
  return fetchApi(`/${system}/spells/${key}/analyze${query ? `?${query}` : ''}`);
}

export function compareSpells(system = 'dnd5e-2014', spellKeys, context = {}) {
  return fetchApi(`/${system}/spells/compare`, {
    method: 'POST',
    body: JSON.stringify({ spellKeys, context }),
  });
}

export function getBestSpells(system = 'dnd5e-2014', slotLevel, context = {}) {
  const params = new URLSearchParams();

  if (context.casterLevel) params.append('casterLevel', context.casterLevel);
  if (context.spellMod) params.append('spellMod', context.spellMod);
  if (context.targetAC) params.append('targetAC', context.targetAC);
  if (context.targets) params.append('targets', context.targets);

  const query = params.toString();
  return fetchApi(`/${system}/spells/best/${slotLevel}${query ? `?${query}` : ''}`);
}

export function getDamageSpells(system = 'dnd5e-2014') {
  return fetchApi(`/${system}/spells/damage`);
}

// Legacy API (existing optimizer)
export function optimizeCharacter(character) {
  return fetchApi('/optimize', {
    method: 'POST',
    body: JSON.stringify(character),
  });
}

export function generateCheatsheet(character) {
  return fetchApi('/cheatsheet', {
    method: 'POST',
    body: JSON.stringify(character),
  });
}
