# Read and Rip

A mobile web game from USA Lacrosse. Read the cue, then tap the spot on a 3x3 goal
grid before time runs out. Play as the shooter or the goalie, on a boys or girls field.
Anyone can play. Scores stay on your device.

**Status:** Phase 0 (setup). The start screen and field view work. Gameplay comes in
Phase 1. See `BUILD.md`.

## Docs

- `SPEC.md`: how the game works (loop, modes, scoring, ramp, saved data, accessibility)
- `BUILD.md`: decisions, open questions, next steps
- `schemas/scenario.schema.json`: the scenario format

## Run it

Needs Node 22 or newer.

```bash
npm install
npm run dev        # local dev server
npm run check      # validate scenarios, typecheck, unit tests, production build
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run validate` | Check every scenario file. Add `-- --strict` to also fail on drafts |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (Vitest) |

## Layout

```
brand/            tokens.css (all colors, type, spacing), fonts/ and logo/ placeholders
schemas/          scenario JSON Schema
scenarios/        boys/ and girls/, one JSON file per scenario
scripts/          validate-scenarios.mjs, make-icons.mjs
src/field/        canvas field view and the 3x3 grid buttons
src/scenarios/    scenario types
src/storage/      localStorage shape and helpers, with tests
src/ui/           theme reader, logo
public/icons/     app icons (code-drawn SVG, PNGs rendered from it)
```

## Adding a scenario

1. Copy a file in `scenarios/boys/` or `scenarios/girls/`.
2. Rename it to the new `id` (for example `girls-goalie-hip-turn-004.json`).
3. Fill in the fields. Zones are named from the shooter's view (see `SPEC.md`).
4. Keep `status: "draft"` until a coach or official signs off.
5. Run `npm run validate`.

## Brand rules

- Colors only in `brand/tokens.css`. No hex values in components.
- No AI imagery. Art is drawn in code.
- No em dashes in any copy.

## Deploy

Every push to `main` runs the checks and publishes to GitHub Pages through
`.github/workflows/deploy.yml`. Pull requests run the checks without publishing.

One-time setup: in the repo, go to **Settings > Pages** and set **Source** to
**GitHub Actions**. The site lands at `https://<owner>.github.io/read-and-rip/`.
A private repo needs a paid GitHub plan for Pages.

## Install on a phone

Open the site, then use **Add to Home Screen** (iOS Safari) or **Install app**
(Android Chrome). It works offline after the first visit.
