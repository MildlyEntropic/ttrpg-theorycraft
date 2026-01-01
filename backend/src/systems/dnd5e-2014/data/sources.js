// Open5e API endpoint configuration for D&D 5e (2014)

export const API_BASE = 'https://api.open5e.com';

export const ENDPOINTS = {
  spells: '/v2/spells/',
  feats: '/v2/feats/',
  classes: '/v1/classes/',
  monsters: '/v1/monsters/',
  magicItems: '/v1/magicitems/',
  weapons: '/v2/weapons/',
  armor: '/v2/armor/',
  conditions: '/v2/conditions/',
  backgrounds: '/v2/backgrounds/',
  races: '/v1/races/'
};

export const SYSTEM_ID = 'dnd5e-2014';

// Pagination settings
export const PAGE_SIZE = 100;
