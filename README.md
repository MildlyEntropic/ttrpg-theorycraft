# TTRPG Theorycraft

A D&D 5e combat optimizer and spell analyzer. **Fully static** - deploys to Vercel/Netlify/GitHub Pages with zero backend.

## Features

- **Spell Browser**: 2,500+ spells with filtering by level, school, class, damage type
- **Spell Analysis**: DPR calculations, efficiency ratings, tactical notes
- **Spell Comparison**: Compare up to 6 spells side-by-side
- **Character Optimization**: GWM/Sharpshooter breakpoints, class-specific recommendations
- **Cheat Sheets**: Printable combat reference cards

## Quick Start

```bash
# Install dependencies
cd frontend
npm install

# Development
npm run dev    # http://localhost:3000

# Production build
npm run build  # Output in frontend/dist/
```

## Deploy to Vercel/Netlify

The `frontend/dist/` folder is a complete static site:

```bash
# Build
npm run build

# Deploy (Vercel)
cd frontend
npx vercel --prod

# Or (Netlify)
npx netlify deploy --prod --dir=dist
```

**That's it.** No backend, no database, no environment variables.

## Data

All spell/feat/class data is pre-bundled as static JSON (~4MB total, ~400KB gzipped):

| File | Contents |
|------|----------|
| `data/spells.json` | 2,528 spells |
| `data/feats.json` | 290 feats |
| `data/classes.json` | 23 classes with subclasses |

### Updating Data

The data comes from the backend's database. To refresh:

```bash
# Requires backend/node_modules to be installed
node scripts/export-data.cjs

# Then rebuild
npm run build
```

## Architecture

```
frontend/
  src/
    lib/
      calculator.js      # GWM breakpoints, combat math
      spell-analyzer.js  # DPR analysis, AoE calculations
      dice.js            # Dice expression parser
      data.js            # Static JSON loader
    components/          # React UI
    hooks/               # React hooks for data
  public/
    data/                # Static JSON files
  dist/                  # Production build output

backend/                 # Only needed for data sync
  data/ttrpg.db          # SQLite database
  src/                   # Sync scripts (wikidot, Open5e)
```

## Data Sources

| Source | Content | License |
|--------|---------|---------|
| [dnd5e.wikidot.com](https://dnd5e.wikidot.com) | Full PHB content | CC-BY-SA 3.0 |
| [Open5e](https://open5e.com) | SRD 5.1 | OGL |

## License

MIT License - see [LICENSE](LICENSE)

D&D 5e content from wikidot is licensed under [CC-BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
