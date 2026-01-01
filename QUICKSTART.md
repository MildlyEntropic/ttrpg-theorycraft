# TTRPG Optimizer - Quick Start

## Prerequisites

- Node.js installed

## Setup

### 1. Backend (Terminal 1)

```bash
cd backend
npm install
npm start
```

Runs on port 3001.

### 2. Sync D&D 5e Data (First Time Only)

After starting the backend, sync the database.

**Option A: Full PHB from Wikidot (Recommended)**

```bash
# 574 spells (includes all PHB spells)
curl -X POST http://localhost:3001/api/sync/dnd5e-2014/wikidot-spells

# 199 feats
curl -X POST http://localhost:3001/api/sync/dnd5e-2014/wikidot-feats

# 83 races/lineages
curl -X POST http://localhost:3001/api/sync/dnd5e-2014/wikidot-lineages

# 227 subclasses
curl -X POST http://localhost:3001/api/sync/dnd5e-2014/wikidot-classes
```

Each sync takes 1-3 minutes due to rate limiting.

**Option B: SRD Only from Open5e**

```bash
curl -X POST http://localhost:3001/api/sync/dnd5e-2014
```

This only includes SRD 5.1 content (~300 spells, 91 feats).

### 3. Frontend (Terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Runs on port 5173 (Vite default).

## Access

Open **http://localhost:5173** in your browser.

## Features

### Spell Browser
- Browse all D&D 5e spells
- Filter by level, school, class, damage type
- Source filter: wikidot (full PHB) or SRD only
- Click any spell for detailed analysis:
  - Expected damage calculation
  - Hit/save probability
  - Slot efficiency rating
  - Tactical notes
  - Damage type choice detection (Chromatic Orb, etc.)

### Spell Comparison
- Compare up to 6 spells side-by-side
- Set combat context (caster level, target AC, etc.)
- See which spell deals the most damage

### Character Optimizer
- Enter character stats and feats
- Get GWM/Sharpshooter breakpoints
- Class-specific recommendations (Barbarian, Monk, Paladin)
- Printable cheat sheet

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `POST /api/sync/dnd5e-2014/wikidot-spells` | Sync spells from wikidot |
| `POST /api/sync/dnd5e-2014/wikidot-feats` | Sync feats from wikidot |
| `POST /api/sync/dnd5e-2014/wikidot-lineages` | Sync races from wikidot |
| `POST /api/sync/dnd5e-2014/wikidot-classes` | Sync classes from wikidot |
| `GET /api/dnd5e-2014/spells` | List spells (with filters) |
| `GET /api/dnd5e-2014/spells/:key` | Get spell details |
| `GET /api/dnd5e-2014/spells/:key/analyze` | Analyze spell DPR |
| `POST /api/dnd5e-2014/spells/compare` | Compare multiple spells |
| `POST /api/optimize` | Character optimization |
| `POST /api/cheatsheet` | Generate cheat sheet |

### Export API (for dnd2014.wikidot.com)

Export data in wikidot-compatible format for populating dnd2014.wikidot.com:

| Endpoint | Description |
|----------|-------------|
| `GET /api/export/wikidot/summary` | Export summary with counts |
| `GET /api/export/wikidot/spells` | All spells in wikidot format |
| `GET /api/export/wikidot/spell/:key` | Single spell in wikidot format |
| `GET /api/export/wikidot/feats` | All feats in wikidot format |
| `GET /api/export/wikidot/lineages` | All races in wikidot format |

Example:
```bash
# Get fireball in wikidot markup
curl http://localhost:3001/api/export/wikidot/spell/wikidot_fireball

# Export all spells (paginated)
curl "http://localhost:3001/api/export/wikidot/spells?limit=50&offset=0"
```

## Database Contents

After syncing from wikidot:

| Resource | Count |
|----------|-------|
| Spells | 574 |
| Feats | 199 |
| Races/Lineages | 83 |
| Subclasses | 227 |

## Summary

| Component | Command     | Port |
|-----------|-------------|------|
| Backend   | `npm start` | 3001 |
| Frontend  | `npm run dev` | 5173 |
