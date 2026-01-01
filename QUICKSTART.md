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

After starting the backend, sync the spell database:

```bash
curl -X POST http://localhost:3001/api/sync/dnd5e-2014/spells
curl -X POST http://localhost:3001/api/sync/dnd5e-2014/feats
```

Or sync everything at once:

```bash
curl -X POST http://localhost:3001/api/sync/dnd5e-2014
```

This downloads ~2000 spells and 91 feats from Open5e.

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

### Character Optimizer (Original)
- Enter character stats and feats
- Get GWM/Sharpshooter breakpoints
- Class-specific recommendations (Barbarian, Monk, Paladin)
- Printable cheat sheet

### Spell Browser (New)
- Browse all 1954 D&D 5e spells
- Filter by level, school, class, damage type
- Click any spell for detailed analysis:
  - Expected damage calculation
  - Hit/save probability
  - Slot efficiency rating
  - Tactical notes

### Spell Comparison (New)
- Compare up to 6 spells side-by-side
- Set combat context (caster level, target AC, etc.)
- See which spell deals the most damage

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `POST /api/sync/dnd5e-2014` | Sync all data from Open5e |
| `GET /api/dnd5e-2014/spells` | List spells (with filters) |
| `GET /api/dnd5e-2014/spells/:key` | Get spell details |
| `GET /api/dnd5e-2014/spells/:key/analyze` | Analyze spell DPR |
| `POST /api/dnd5e-2014/spells/compare` | Compare multiple spells |
| `POST /api/optimize` | Character optimization |
| `POST /api/cheatsheet` | Generate cheat sheet |

## Summary

| Component | Command     | Port |
|-----------|-------------|------|
| Backend   | `npm start` | 3001 |
| Frontend  | `npm run dev` | 5173 |
