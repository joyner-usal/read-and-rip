# Read and Rip: Build Log

Last updated 2026-11-04. Product owner: Marty Joyner, Digital Learning and Education, USA Lacrosse.

## Where things stand

**Phase 1 (playable core): built, in review.** Phase 0 (setup) is merged and live.

Phase 1 adds:

- Game loop as a pure TypeScript state machine (`src/game/machine.ts`): set up, read,
  feedback, summary, with pause. No React inside; driven by events with timestamps
- Round clock that runs only in set up and read (`src/game/clock.ts`)
- Scoring (`scoring.ts`) and ramp plus scenario picking (`ramp.ts`), mirroring
  (`mirror.ts`), zone helpers and result words (`zones.ts`, `copy.ts`)
- Scenario loader (`src/scenarios/loader.ts`): approved only in production, drafts in
  dev or with `VITE_INCLUDE_DRAFTS=true` (D21), mirrors added, content hash stamped
- Cue animation as data (`src/anim/cues.ts`): goalie rig (stance, crouch, stick), the
  goalie closing a baited spot, shooter rig (stick load, pump fakes, release, ball
  flight), still key frames for reduced motion
- Canvas scene (`src/field/scene.ts`): per pack crease size, girls 8 meter arc with hash
  marks, net depth, boys and girls stick heads. Placeholder art, drawn in code
- Screens: start, game (HUD, field, feedback panel, pause), summary with reads to
  review, settings (reduced motion, longer read windows, vibration), Practice mode
- Keys 1 to 9, Space or Enter to continue, P or Escape to pause; leaving the tab pauses
- Validator: bait and close fields, mirror side-word warnings, `-m` reserved
- 14 more draft sample scenarios (18 in all, 36 with mirrors): every pack and mode
  covers difficulty 1 to 5 and has a fake

Checked: validator (18 valid, 0 warnings), typecheck, 114 unit tests, production build.
Played at iPhone 13 size (390 x 664): full timed rounds to the summary, Practice, pause,
a shooter bait rep, goalie mode with reduced motion, settings. No console errors, no
scrolling on the game screen, every zone at least 67 x 71 px, result labels fit their
cells. The production build shows "No approved scenarios yet" (D21).

Worth knowing: the clock stops during feedback, so a 30-second round takes about 60 to
75 seconds of real time for a fast player.

<details><summary>Phase 0 (setup), done</summary>

- Vite + React + TypeScript, installable PWA (works offline after first load)
- Canvas field view from behind the shooter's stick, with a 3x3 grid of real buttons
- Start screen: pick Boys or Girls, Shooter or Goalie. Choices save to the device
- `SPEC.md`, scenario schema, validator, 4 sample scenarios (all drafts, not real content)
- `brand/tokens.css` with placeholder font files and logo
- GitHub Actions: validate, typecheck, test, build, deploy to Pages
- Checked: validator, typecheck, 4 unit tests and production build all pass. Tested on
  an iPhone 13 sized screen: no console errors, no sideways scroll, service worker
  registers, settings persist.

</details>

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | Vite 8, React 19, TypeScript 7 (the new native compiler) | Current releases. If any tool chokes on TS 7, pin TypeScript 5.9 |
| D2 | Canvas draws the scene. The grid is HTML buttons on top | Canvas for smooth drawing; buttons for keyboard, screen reader and switch access |
| D3 | Zones are named from the shooter's view in both modes | One camera, one grid. Goalie feedback names both sides |
| D4 | Colors only in `brand/tokens.css`. Canvas reads them at draw time | Matches the no-hex rule. Exceptions: manifest colors, `theme-color` meta, icon SVG (can't read CSS) |
| D5 | Fonts are self-hosted. No Google Fonts | Works offline; no third-party requests from a youth game |
| D6 | Fields added to the schema: `schemaVersion`, `releaseMs`, `difficulty`, `status` | The ramp needs difficulty. The fake penalty needs to know when the real shot is released. Status keeps unreviewed content from shipping |
| D7 | ~~Fakes are goalie mode only in v1~~ Replaced by D15 | |
| D8 | One storage key, versioned, with ids, owner and `syncedAt` on each record | Accounts can sync later without reshaping data |
| D9 | No personal data, accounts or analytics in v1 | Simplest safe path for a youth audience |
| D10 | Pull requests run checks only; `main` deploys | Nothing reaches the live site without passing checks |
| D11 | The validator bans em dashes, en dashes and `--` in rules notes | Enforces the copy rule on content as it scales |
| D12 | One 30-second clock per round; reps run back to back (Marty, 2026-11-04) | Keeps reads quick and the round short enough to replay |
| D13 | GitHub Pages Source set to GitHub Actions (Marty, 2026-11-04) | `main` deploys through `.github/workflows/deploy.yml` |
| D14 | Speed bonus +1 for a best or good tap in the first half of the read window (Marty, 2026-11-04) | Rewards quick, correct reads. Threshold and value get tuned after playtests |
| D15 | Fakes in both modes (Marty, 2026-11-04). Shooter mode: goalie shows `baitZone` open, closes it at `closeMs`; tapping it is "Took the bait 0". Goalie mode keeps the -1 early tap. Fakes only at ramp level 3 and up | Both positions get fooled in real games; reading past a fake is the skill |
| D16 | Scenarios mirror left to right unless `mirror: false` (Marty, 2026-11-04). Copies get `-m` and count in the pool. Validator warns on side words in mirrored rules notes | Doubles the pool and trains both sides. The warning catches notes that stop being true when flipped |
| D17 | Practice mode in v1 (Marty, 2026-11-04): no clock, no ramp, windows doubled, rules note every rep, never a best | The main timing accommodation, and a place to learn without pressure |
| D18 | Brand colors confirmed per HQ D73 (Marty, 2026-11-04): navy #001F58, red #FC222D | Closes the color question. Red stays limited to large text and accents for contrast |
| D19 | Timed rounds show the rules note only in the summary, not after each rep (Claude, Phase 1 default; confirm) | A 1.2 s feedback beat is too short to read a note. Practice shows it every rep (D17) |
| D20 | Practice draws from every difficulty, fakes included (Claude, Phase 1 default; confirm) | Practice has no ramp, so there is no level to gate fakes on |
| D21 | Production builds load approved scenarios only. Dev, and any build with `VITE_INCLUDE_DRAFTS=true`, also load drafts and show a "Draft content" banner (Claude, Phase 1) | Keeps unreviewed content off the live site while still allowing playtests |
| D22 | Fonts are never committed (repo is public). `.gitignore` blocks font files in `brand/fonts/` (Marty, 2026-11-04) | License protection. Fallback fonts render until licensed hosting is sorted out |

## Open questions

Each one has a recommendation. Answers go into `SPEC.md`.

1. **Font hosting:** the repo is public, so font files can't live in it (D22). Where
   should licensed Vanguard CF and Mundial WOFF2 files be served from, if at all?
   Until then the fallback fonts show.
2. **Content review:** who signs off on boys and girls scenarios before `status` goes
   to `approved`?
3. **Rules notes:** should each note cite a rule (NFHS, USA Lacrosse youth rules), or
   stay as plain coaching tips?
4. **Hosting:** GitHub Pages on `joyner-usal`, or a usalacrosse.com subdomain later?
5. **Name styling:** "Read and Rip" or "Read & Rip"?
6. **Live site before content is approved:** the live site plays approved scenarios
   only (D21), and all scenarios are drafts, so it shows "No approved scenarios yet".
   Should `main` build with drafts and the "Draft content" banner until launch?

## Next steps

### Phase 1: playable core (built, see top)

Known limits to pick up in Phase 2:

- The side-word warning can't tell "left" the direction from "left" the verb, so a
  reviewer sometimes dismisses a false alarm
- Field markings, crease sizes and stick heads are approximate art; check them against
  the current rulebooks
- No sound yet (the saved `sound` setting is unused)
- Cue poses come from the best zone and cue type by rule. Real cues from coaches may
  need hand-tuned poses per scenario

### Phase 2: content and playtest

- Write real scenarios from coach and official input; target at least 20 per pack per
  mode before launch
- Playtest with players, parents and goalies of different ages; tune windows and ramp
- Accessibility check with a screen reader (VoiceOver, TalkBack) and reduced motion

### Phase 3: later

- Accounts and sync (data shape is ready), leaderboards, new packs

## Needed from Marty

See open questions above. Plus:

- A decision on font hosting (open question 1). Font files never go in this repo
- Approved USA Lacrosse logo files (SVG, light and dark backgrounds)
- Names of scenario reviewers for boys and girls
- Any source material for cues (coaching drills, goalie training guides)
