# Read and Rip

A mobile web game from USA Lacrosse. Read the cue, then tap the spot on a 3x3 goal
grid before time runs out. Play as the shooter or the goalie, on a boys or girls field.
Anyone can play. Scores stay on your device.

**Status:** Phase 1 (playable core). Timed rounds, Practice mode, both positions, both
fields, fakes and mirrored scenarios all work. Every scenario is still a draft, so the
live site says "No approved scenarios yet" until coaches approve content. See
`BUILD.md`.

## How to play

Pick Boys or Girls and Shooter or Goalie. The cue plays; tap the zone (or press 1 to 9,
numbered like a phone keypad read left to right, top to bottom). Best +3, good +1,
+1 more for a correct read in the first half of the window. Watch for fakes from
level 3 up. Practice mode has no clock and shows the coaching note after every rep.

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
| `npm run dev` | Dev server with hot reload. Plays draft scenarios too |
| `npm run build` | Production build into `dist/`. Approved scenarios only; set `VITE_INCLUDE_DRAFTS=true` to include drafts with a banner |
| `npm run preview` | Serve the production build |
| `npm run validate` | Check every scenario file. Add `-- --strict` to also fail on drafts |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (Vitest) |

## Layout

```
brand/            tokens.css (all colors, type, spacing), fonts/ and logo/ placeholders
schemas/          scenario JSON Schema
scenarios/        boys/ and girls/, one JSON file per scenario
scripts/          validate-scenarios.mjs, scenario-rules.mjs, make-icons.mjs
src/game/         the game loop (pure TypeScript): machine, clock, scoring, ramp, mirror
src/anim/         cue animation as data (poses over time)
src/field/        canvas scene and the 3x3 grid buttons
src/screens/      start, game, summary, settings
src/scenarios/    scenario types and loader
src/storage/      localStorage shape and helpers, with tests
src/ui/           theme reader, icons, motion setting, logo
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
- Never commit font files: the repo is public. Fallback fonts render until hosting is
  settled.
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
