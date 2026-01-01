# TTRPG Theorycraft

A system-agnostic TTRPG optimization engine, starting with D&D 5e (2014).

## Features

- **Spell Analysis**: DPR calculations, efficiency ratings, tactical notes
- **Character Optimization**: GWM/Sharpshooter breakpoints, class-specific recommendations
- **Full PHB Content**: 574 spells, 199 feats, 83 races, 227 subclasses from wikidot

## Quick Start

```bash
# Backend
cd backend
npm install
npm start  # Port 3001

# Frontend (separate terminal)
cd frontend
npm install
npm run dev  # Port 5173
```

Then sync the database (first time only):

```bash
# Full PHB content from wikidot (recommended)
curl -X POST http://localhost:3001/api/sync/dnd5e-2014/wikidot-spells
curl -X POST http://localhost:3001/api/sync/dnd5e-2014/wikidot-feats
curl -X POST http://localhost:3001/api/sync/dnd5e-2014/wikidot-lineages
curl -X POST http://localhost:3001/api/sync/dnd5e-2014/wikidot-classes

# Or SRD-only from Open5e
curl -X POST http://localhost:3001/api/sync/dnd5e-2014
```

Open **http://localhost:5173**

## Data Sources

| Source | Content | License |
|--------|---------|---------|
| [dnd5e.wikidot.com](https://dnd5e.wikidot.com) | Full PHB (574 spells, 199 feats, 83 races, 227 subclasses) | CC-BY-SA 3.0 |
| [Open5e](https://open5e.com) | SRD 5.1 only (~300 spells, 91 feats) | OGL |

## API

```
GET  /api/dnd5e-2014/spells              # List spells
GET  /api/dnd5e-2014/spells/:key         # Get spell
GET  /api/dnd5e-2014/spells/:key/analyze # Analyze spell DPR
POST /api/dnd5e-2014/spells/compare      # Compare spells
POST /api/sync/dnd5e-2014/wikidot-spells # Sync wikidot spells
```

## Wikidot Export (for dnd2014.wikidot.com)

Export data in wikidot markup format to help populate the dnd2014 wiki:

```
GET /api/export/wikidot/summary          # What's available to export
GET /api/export/wikidot/spells           # All spells (paginated)
GET /api/export/wikidot/spell/:key       # Single spell with wikidot markup
GET /api/export/wikidot/feats            # All feats
GET /api/export/wikidot/lineages         # All races/lineages
```

**Current export counts**: 574 spells, 290 feats, 83 lineages, 23 classes

Each export includes wikidot-formatted page content ready for copy-paste into the wiki editor.

## Architecture

```
backend/
  src/
    api/routes/          # Express routes
    engine/calculator/   # Dice, probability math
    systems/dnd5e-2014/  # D&D 5e specific logic
      analyzers/         # Spell DPR, feat breakpoints
      data/              # Sync scripts, DB queries
frontend/
  src/
    components/          # React components
    hooks/               # Data fetching hooks
```

## License

MIT License - see [LICENSE](LICENSE)

D&D 5e content from wikidot is licensed under [CC-BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
