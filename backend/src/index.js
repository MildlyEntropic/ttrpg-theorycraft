import express from 'express';
import cors from 'cors';
import { calculateBreakpoints } from './calculator.js';
import { generateCheatSheet } from './cheatsheet.js';
import { getDb, closeDb } from './data/db.js';
import syncRoutes from './api/routes/sync.js';
import spellRoutes from './api/routes/spells.js';

const app = express();
app.use(cors());
app.use(express.json());

// Initialize database on startup
try {
  getDb();
  console.log('Database initialized');
} catch (error) {
  console.error('Database initialization failed:', error);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  closeDb();
  process.exit(0);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0' });
});

// New API routes for D&D 5e
app.use('/api/sync', syncRoutes);
app.use('/api/dnd5e-2014/spells', spellRoutes);

// Calculate optimal breakpoints for a character
app.post('/api/optimize', (req, res) => {
  try {
    const character = req.body;
    const results = calculateBreakpoints(character);
    res.json(results);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Generate printable cheat sheet
app.post('/api/cheatsheet', (req, res) => {
  try {
    const character = req.body;
    const breakpoints = calculateBreakpoints(character);
    const cheatsheet = generateCheatSheet(character, breakpoints);
    res.json(cheatsheet);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`TTRPG Optimizer API running on port ${PORT}`);
});
