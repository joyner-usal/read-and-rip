# Read and Rip: Build Log

Last updated 2026-11-04. Product owner: Marty Joyner, Digital Learning and Education, USA Lacrosse.

## Where things stand

**Phase 0 (setup): done.**

- Vite + React + TypeScript, installable PWA (works offline after first load)
- Canvas field view from behind the shooter's stick, with a 3x3 grid of real buttons
- Start screen: pick Boys or Girls, Shooter or Goalie. Choices save to the device
- `SPEC.md`, scenario schema, validator, 4 sample scenarios (all drafts, not real content)
- `brand/tokens.css` with placeholder font files and logo
- GitHub Actions: validate, typecheck, test, build, deploy to Pages
- Checked: validator, typecheck, 4 unit tests and production build all pass. Tested on
  an iPhone 13 sized screen: no console errors, no sideways scroll, service worker
  registers, settings persist.

No gameplay yet: no clock, no scoring, no cue animation.

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| D1 | Vite 8, React 19, TypeScript 7 (the new native compiler) | Current releases. If any tool chokes on TS 7, pin TypeScript 5.9 |
| D2 | Canvas draws the scene. The grid is HTML buttons on top | Canvas for smooth drawing; buttons for keyboard, screen reader and switch access |
| D3 | Zones are named from the shooter's view in both modes | One camera, one grid. Goalie feedback names both sides |
| D4 | Colors only in `brand/tokens.css`. Canvas reads them at draw time | Matches the no-hex rule. Exceptions: manifest colors, `theme-color` meta, icon SVG (can't read CSS) |
| D5 | Fonts are self-hosted. No Google Fonts | Works offline; no third-party requests from a youth game |
| D6 | Fields added to the schema: `schemaVersion`, `releaseMs`, `difficulty`, `status` | The ramp needs difficulty. The fake penalty needs to know when the real shot is released. Status keeps unreviewed content from shipping |
| D7 | Fakes are goalie mode only in v1 | The -1 rule is written for goalies. See open question 3 |
| D8 | One storage key, versioned, with ids, owner and `syncedAt` on each record | Accounts can sync later without reshaping data |
| D9 | No personal data, accounts or analytics in v1 | Simplest safe path for a youth audience |
| D10 | Pull requests run checks only; `main` deploys | Nothing reaches the live site without passing checks |
| D11 | The validator bans em dashes, en dashes and `--` in rules notes | Enforces the copy rule on content as it scales |
| D12 | One 30-second clock per round; reps run back to back (Marty, 2026-11-04) | Keeps reads quick and the round short enough to replay |
| D13 | GitHub Pages Source set to GitHub Actions (Marty, 2026-11-04) | `main` deploys through `.github/workflows/deploy.yml` |
| D14 | Speed bonus +1 for a best or good tap in the first half of the read window (Marty, 2026-11-04) | Rewards quick, correct reads. Threshold and value get tuned after playtests |

## Open questions

Each one has a recommendation. Answers go into `SPEC.md`.

1. **Fakes in shooter mode:** should the goalie ever bait the shooter (show an open spot,
   then close it)? *Recommend no for v1.*
2. **Brand colors:** this build uses navy #001F58, red #FC222D and off-white #FAF7F6 as
   requested. LAXLEARN and the Parent Guide use navy #00205B and red #C8102E. Which set
   is current? The red here fails contrast for small text, so it's limited to large
   text and accents (see `SPEC.md` section 8).
3. **Font license:** does the USA Lacrosse license for Vanguard CF and Mundial cover
   self-hosted web use (WOFF2)?
4. **Content review:** who signs off on boys and girls scenarios before `status` goes
   to `approved`?
5. **Rules notes:** should each note cite a rule (NFHS, USA Lacrosse youth rules), or
   stay as plain coaching tips?
6. **Mirroring:** can the game flip a scenario left to right (angle, hand and zones) to
   double the pool? Only if the rules note doesn't depend on side.
7. **Practice mode in v1?** *Recommend yes.* It's the main timing accommodation.
8. **Hosting:** GitHub Pages on `joyner-usal`, or a usalacrosse.com subdomain later?
    Pages on a private repo needs a paid GitHub plan.
9. **Name styling:** "Read and Rip" or "Read & Rip"?

## Next steps

### Phase 1: playable core

- Game state machine in plain TypeScript (start, set up, read, feedback, summary),
  fully unit tested and kept apart from React
- Round clock with pause; timing on `performance.now()` and `pointerdown`
- Scoring and ramp modules with tests that cover every row in `SPEC.md` sections 4 and 5
- Scenario loader: bundles approved scenarios only (drafts allowed in dev)
- Cue animation on canvas: goalie rig (stick, weight, stance) and shooter rig (hands,
  hips, shoulders, release), plus still key frames for reduced motion
- Feedback overlay, round summary, settings screen, keyboard 1 to 9
- Art pass on the field: crease, net depth, pack-specific markings

### Phase 2: content and playtest

- Write real scenarios from coach and official input; target at least 20 per pack per
  mode before launch
- Playtest with players, parents and goalies of different ages; tune windows and ramp
- Accessibility check with a screen reader (VoiceOver, TalkBack) and reduced motion

### Phase 3: later

- Accounts and sync (data shape is ready), leaderboards, new packs

## Needed from Marty

See open questions above. Plus:

- Access: the repo `joyner-usal/read-and-rip` must exist and the Claude GitHub App must
  be allowed on it, so this work can be pushed
- Font files (WOFF2) for Vanguard CF and Mundial, once the web license is confirmed
- Approved USA Lacrosse logo files (SVG, light and dark backgrounds)
- Names of scenario reviewers for boys and girls
- Any source material for cues (coaching drills, goalie training guides)
