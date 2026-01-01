import { Router } from 'express';
import { syncAll, syncSpells, syncFeats, syncClasses, syncMonsters, syncMagicItems, getSyncStatus } from '../../systems/dnd5e-2014/data/sync.js';
import { syncWikidotSpells, testScrapeSpell, listWikidotSpells } from '../../systems/dnd5e-2014/data/wikidot-sync.js';
import { syncWikidotFeats, testScrapeFeat, listWikidotFeats } from '../../systems/dnd5e-2014/data/wikidot-feats.js';
import { syncWikidotLineages, testScrapeLineage, listWikidotLineages } from '../../systems/dnd5e-2014/data/wikidot-lineages.js';
import { syncWikidotClasses, testScrapeClass, listWikidotClasses } from '../../systems/dnd5e-2014/data/wikidot-classes.js';

const router = Router();

// Get sync status for a system
router.get('/:system/status', (req, res) => {
  const { system } = req.params;

  if (system !== 'dnd5e-2014') {
    return res.status(404).json({ error: `Unknown system: ${system}` });
  }

  try {
    const status = getSyncStatus();
    res.json({
      system,
      status,
      lastChecked: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync all data for a system
router.post('/:system', async (req, res) => {
  const { system } = req.params;

  if (system !== 'dnd5e-2014') {
    return res.status(404).json({ error: `Unknown system: ${system}` });
  }

  try {
    console.log(`Starting full sync for ${system}...`);
    const results = await syncAll();
    res.json({
      system,
      success: true,
      results,
      syncedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync specific resource type
router.post('/:system/:resource', async (req, res) => {
  const { system, resource } = req.params;

  if (system !== 'dnd5e-2014') {
    return res.status(404).json({ error: `Unknown system: ${system}` });
  }

  const syncFunctions = {
    spells: syncSpells,
    feats: syncFeats,
    classes: syncClasses,
    monsters: syncMonsters,
    'magic-items': syncMagicItems,
    'wikidot-spells': () => syncWikidotSpells(req.body),
    'wikidot-feats': () => syncWikidotFeats(req.body),
    'wikidot-lineages': () => syncWikidotLineages(req.body),
    'wikidot-classes': () => syncWikidotClasses(req.body)
  };

  const syncFn = syncFunctions[resource];
  if (!syncFn) {
    return res.status(404).json({ error: `Unknown resource: ${resource}` });
  }

  try {
    console.log(`Starting sync for ${system}/${resource}...`);
    const count = await syncFn();
    res.json({
      system,
      resource,
      success: true,
      count,
      syncedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Sync error for ${resource}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Test scrape a single spell from wikidot
router.get('/:system/wikidot/test/:spell', async (req, res) => {
  const { system, spell } = req.params;

  if (system !== 'dnd5e-2014') {
    return res.status(404).json({ error: `Unknown system: ${system}` });
  }

  try {
    console.log(`Test scraping spell: ${spell}`);
    const result = await testScrapeSpell(spell);
    res.json({ spell, result });
  } catch (error) {
    console.error(`Error scraping ${spell}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// List all spells from wikidot
router.get('/:system/wikidot/list', async (req, res) => {
  const { system } = req.params;

  if (system !== 'dnd5e-2014') {
    return res.status(404).json({ error: `Unknown system: ${system}` });
  }

  try {
    const spells = await listWikidotSpells();
    res.json({ count: spells.length, spells });
  } catch (error) {
    console.error('Error listing spells:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test scrape a single feat from wikidot
router.get('/:system/wikidot/feat/:feat', async (req, res) => {
  const { system, feat } = req.params;

  if (system !== 'dnd5e-2014') {
    return res.status(404).json({ error: `Unknown system: ${system}` });
  }

  try {
    console.log(`Test scraping feat: ${feat}`);
    const result = await testScrapeFeat(feat);
    res.json({ feat, result });
  } catch (error) {
    console.error(`Error scraping ${feat}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// List all feats from wikidot
router.get('/:system/wikidot/feats', async (req, res) => {
  const { system } = req.params;

  if (system !== 'dnd5e-2014') {
    return res.status(404).json({ error: `Unknown system: ${system}` });
  }

  try {
    const feats = await listWikidotFeats();
    res.json({ count: feats.length, feats });
  } catch (error) {
    console.error('Error listing feats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test scrape a single lineage from wikidot
router.get('/:system/wikidot/lineage/:lineage', async (req, res) => {
  const { system, lineage } = req.params;

  if (system !== 'dnd5e-2014') {
    return res.status(404).json({ error: `Unknown system: ${system}` });
  }

  try {
    console.log(`Test scraping lineage: ${lineage}`);
    const result = await testScrapeLineage(lineage);
    res.json({ lineage, result });
  } catch (error) {
    console.error(`Error scraping ${lineage}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// List all lineages from wikidot
router.get('/:system/wikidot/lineages', async (req, res) => {
  const { system } = req.params;

  if (system !== 'dnd5e-2014') {
    return res.status(404).json({ error: `Unknown system: ${system}` });
  }

  try {
    const lineages = await listWikidotLineages();
    res.json({ count: lineages.length, lineages });
  } catch (error) {
    console.error('Error listing lineages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test scrape a single class from wikidot
router.get('/:system/wikidot/class/:classSlug', async (req, res) => {
  const { system, classSlug } = req.params;

  if (system !== 'dnd5e-2014') {
    return res.status(404).json({ error: `Unknown system: ${system}` });
  }

  try {
    console.log(`Test scraping class: ${classSlug}`);
    const result = await testScrapeClass(classSlug);
    res.json({ class: classSlug, result });
  } catch (error) {
    console.error(`Error scraping ${classSlug}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// List all classes from wikidot
router.get('/:system/wikidot/classes', async (req, res) => {
  const { system } = req.params;

  if (system !== 'dnd5e-2014') {
    return res.status(404).json({ error: `Unknown system: ${system}` });
  }

  try {
    const classes = await listWikidotClasses();
    res.json({ count: classes.length, classes });
  } catch (error) {
    console.error('Error listing classes:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
