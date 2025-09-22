# Food Label Creator (Apps Script + CLASP)

## Project Layout
- `src/` — Apps Script sources that are pushed via CLASP
  - `Code.gs` — server code
  - `index.html` — UI entry
  - `appsscript.json` — manifest
- `.clasp.json` — CLASP config (rootDir=src, only .gs/.html)
- `.claspignore` — prevents non-script assets from being pushed
- `.gitignore` — keeps repo clean

## Commands
```bash
# Pull from Apps Script → local
clasp pull

# Push local → Apps Script
clasp push

# Open the project in browser
clasp open