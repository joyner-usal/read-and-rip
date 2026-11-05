# Read and Rip: Build Log

Last updated 2026-11-05. Product owner: Marty Joyner, Digital Learning and Education, USA Lacrosse.

## Where things stand

**Phase 1.6 (motion pass, boys): built, in review.** Phases 0, 1 and 1.5 are merged
and live. No new art, no rule or scoring changes.

Phase 1.6 makes every rep show the shooter shoot, the ball fly and the goalie move:

- One timing module, `src/game/timing.ts`: load 120 ms, release hold 160 ms, flight
  600 ms (eased, last 20% at half speed), 70 ms contact freeze, card 250 ms after
  contact sliding up over 200 ms, goalie reaction 120 ms (plus 180 ms when beaten),
  goalie dip 60 ms and travel 300 ms, lean 0.18 rad, stretch 1.08, smear 34 ms at 25%,
  push-in 3%, shakes, net bulge 40 px for 650 ms, tap flash 150 ms
- The sequence is enforced in the engine: each result stores `revealAt` (the card
  time); timed feedback runs 1.2 s from the reveal, and Next or Space can't skip the
  shot. Scoring is still decided at the tap
- Motion model `src/art/motion.ts` (pure): goalie travel with dip, lean, stretch, a
  hard sprite swap at mid-move and one smear frame; the opponent's reaction delay; the
  shooter's load, lunge and follow with hard swaps; camera push-in and shake
- Ball `src/art/ball.ts`: radius 10 to 5 with a 1.5 px outline, 6-point trail, ground
  shadow, slow-motion finish, contact freeze; goal, save (spin trail) and wide (bounce,
  roll, post ping) endings
- Renderer: no crossfades; camera applied to the cached static layer, the dynamic
  layer and the tap grid together; tap ripple plus zone flash
- Reduced motion: three still frames (release, mid-flight, contact) 250 ms apart, then
  the card; no shake, push-in, smear or slow motion

Checked: validator, typecheck, 181 unit tests (the sequence order, the reveal gate and
the reaction delay included), production build. Frame strips on a virtual clock, every
40 ms from tap to card at 390 x 844: shooter goal, wide and save (too late); goalie
save, goal against, and a bitten fake (goalie mode has no wide, D34). Reduced motion
strip: the field changes only at release, mid-flight, contact and card. The goal mouth
measures 165 x 164.5 px at 390 x 844, so zones are 55 px (no fit change needed). No
console errors.

| Mode | CPU 1x | CPU 4x throttle |
| --- | --- | --- |
| Shooter | 60.0 fps, p95 16.7 ms (2x density) | 59.8 fps, p95 16.7 ms (settled at 1x) |
| Goalie | 60.0 fps, p95 16.7 ms (2x density) | 57.1 fps, p95 16.8 ms (settled at 1x) |

Worth knowing: each rep now takes about 1 s from tap to card (120 load + 600 flight +
250 hold) plus the 1.2 s card, and the clock is stopped for all of it, so a 30-second
round runs longer in real time than before.

<details><summary>Phase 1.5 (art and feel, boys), merged</summary>

**Phase 1.5 (art and feel, boys): merged.**

Phase 1.5 adds (gameplay rules and scoring unchanged):

- Boys sprite art from `read-and-rip-sprites.zip`: 17 WebP sprites (660 KB, down from
  9 MB of PNG), each at most 2x its on-screen size, built by `scripts/build-sprites.py`
  with a manifest of draw sizes and anchors (`src/art/boys-sprites.json`). The PNGs stay
  in the zip and never reach `public/` or the build. The spare stick head isn't shipped
- Preloading with a loading screen (and a retry if it fails), started as soon as Boys
  is picked
- Scene layout per the spec (SPEC.md section 10), measured from the art: the crease
  center in the background, the goal mouth, foot lines, helmet edges and stick pockets.
  The navy carry and cocked sprites are drawn 1.46x larger than the other poses in the
  source files; the manifest normalizes them so the helmet never jumps
- Pose logic (`src/art/poses.ts`) and ball flight (`src/art/ball.ts`) as pure, tested
  functions; renderer (`src/art/renderer.ts`) with crossfades, overshoot, idle bob,
  shadow, curved ball with trail, net bulge and ripple, save burst, wide skip, press
  ripple
- New game screen per the style frame: slim navy HUD, red read-window bar, prompt pill,
  compact feedback card with chips and an auto-advance bar; zone tags only in feedback
- Goalie-mode mirrors held back (`mirrorReady: false`, D30): the validator reports 8
- The girls field keeps the code-drawn scene inside the new layout until a girls set
  exists
- Adaptive resolution and a single opaque canvas to hold the frame budget (D37)

Checked: validator (18 valid, 0 warnings, 8 mirrors held back), typecheck, 154 unit
tests, production build. Played at 390 x 844 in both modes (before and after
screenshots), reduced motion (the field is still between frames; only the read bar
moves), loading screen, girls field. No console errors. Frame rate in headless
Chromium, production build, 2x density, in-page autoplay, steady state after warm-up:

| Mode | CPU 1x | CPU 4x throttle |
| --- | --- | --- |
| Shooter | 59.6 fps, p95 frame 16.7 ms, at 2x density | 58.5 fps, p95 16.8 ms, settled at 1x density |
| Goalie | 60.0 fps, p95 16.7 ms, at 2x density | 56.6 fps, p95 33.3 ms, settled at 1x density |

This machine has no GPU, so the browser rasterizes in software and the 4x throttle slows
that too; a CPU profile put 91% of frame time in browser raster and compositing and
about 5% in game code. Real phones composite on the GPU, so treat these as a worst case.

</details>

<details><summary>Phase 1 (playable core), merged</summary>


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
cells. A build without drafts shows "No approved scenarios yet" (D21); the live site
builds with drafts and a banner until launch (D23).

Worth knowing: the clock stops during feedback, so a 30-second round takes about 60 to
75 seconds of real time for a fast player.

</details>

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
| D19 | Timed rounds show the rules note only in the summary, not after each rep (Claude default; confirmed by Marty, 2026-11-04) | A 1.2 s feedback beat is too short to read a note. Practice shows it every rep (D17) |
| D20 | Practice draws from every difficulty, fakes included (Claude default; confirmed by Marty, 2026-11-04) | Practice has no ramp, so there is no level to gate fakes on |
| D21 | Production builds load approved scenarios only. Dev, and any build with `VITE_INCLUDE_DRAFTS=true`, also load drafts and show a "Draft content" banner (Claude default; confirmed by Marty with D23, 2026-11-04) | Keeps unreviewed content off the live site while still allowing playtests |
| D22 | Fonts are never committed (repo is public). `.gitignore` blocks font files in `brand/fonts/` (Marty, 2026-11-04) | License protection. Fallback fonts render until licensed hosting is sorted out |
| D23 | Until launch, the live site plays draft scenarios with the "Draft content" banner (Marty, 2026-11-04). `deploy.yml` sets `VITE_INCLUDE_DRAFTS=true`; remove that line at launch | Lets Marty and reviewers playtest on phones before content is approved |
| D24 | v1 ships with the fallback fonts; no brand font files are loaded (Marty, 2026-11-04) | Revisit once HQ confirms web rights and a hosting place for Vanguard CF and Mundial |
| D25 | `rulesNote` is a plain coaching tip in peer-advice voice, not a rule citation (Marty, 2026-11-04) | Clear for kids and parents, and doesn't go stale when rulebooks change. The field keeps its name |
| D26 | The name is "Read and Rip", written out with "and" (Marty, 2026-11-04) | Reads cleanly aloud and in search |
| D27 | Stay on GitHub Pages through playtesting; pick a usalacrosse.com address closer to launch (Marty, 2026-11-04) | No setup needed now. A subdomain later needs one DNS record |
| D28 | Marty reviews boys and girls scenarios and is the only one who sets `status` to `approved`, until dedicated reviewers are named (Marty, 2026-11-04) | One clear sign-off for v1 content |
| D29 | AI-generated game art is approved for this project; the rule only bans AI images presented as real photos (Marty, 2026-11-05) | The sprite set is illustrated game art, clearly not photography. Marty called this "D19 as clarified"; D19 in this log is the timed-notes decision, so it is logged here |
| D30 | D16 amendment: mirrored copies flip zones and approach data only, never sprites. Goalie-mode mirrors are held back with `mirrorReady: false` until lefty shooter sprites exist; shooter-mode mirrors stay on (Marty, 2026-11-05) | Jersey numbers would read backwards, and in goalie mode the shooter's hand is part of the read |
| D31 | Sprites ship as WebP at no more than 2x on-screen size, quality 85, built from the zip by `scripts/build-sprites.py`; the zip stays the source (Marty, 2026-11-05) | Small, sharp on 2x phones, and the originals never ship |
| D32 | Goalie mode uses the gray goalie poses plus the navy screen-left dive until navy poses arrive (Marty, 2026-11-05) | Open item below |
| D33 | The two boys goalie-mode samples with a left-handed shooter were flipped to right-handed (zones and angle flipped with them); boys goalie-mode lefties are held back in play and flagged by the validator (Claude default; confirmed by Marty, 2026-11-05) | The art has no lefty shooter. These are draft samples, so flipping kept a fake and difficulty 5 in boys goalie mode |
| D34 | How results play out: shooter mode best or good is a goal, a miss skips wide, the bait and a timeout are saved; goalie mode best or good is a save, anything else is a goal against (Claude default; confirmed by Marty, 2026-11-05) | Matches the spec's goal, save and wide effects to each result |
| D35 | Timed rounds auto-advance after feedback with no Next button (Space or Enter still skips); Practice shows Next and never auto-advances (Marty, 2026-11-05) | Keeps timed rounds flowing; Practice is for reading the note |
| D36 | Card wording from the style frame: "Goal", "Save", "Wide", "Scored on", "Too late", "Bit on the fake", "Took the bait"; chips such as "Best spot +3" and "Fast read +1"; timed rounds show the best spot line, Practice the coaching note (Marty, 2026-11-05) | Matches the approved style frame while keeping every point in words |
| D37 | One opaque canvas plus adaptive resolution: density capped at 2, stepping to 1.5 then 1 if frames average slower than about 55 fps (Claude, 2026-11-05) | Measured: two stacked full-screen canvases ran 28 fps at 4x throttle; one canvas at 1x density runs 58 |
| D38 | Short screens crop up to 160 px of sky off the top before the scene shrinks; the bottom stays anchored and wider screens still letterbox (Marty, 2026-11-05) | Keeps goal zones at 51 to 55 px in a phone browser with toolbars (they were 43 px), above the 48 px minimum |
| D39 | The card waits for the shot: it appears 250 ms after contact, and timed feedback runs 1.2 s from then; Next or Space can't skip the shot (Marty's Phase 1.6 brief; the 1.2 s dwell from the reveal confirmed by Marty, 2026-11-05) | The player always sees the shot land, and still gets the full time to read the card |
| D40 | Shooter mode: your tap starts the 120 ms load, so the ball leaves 120 ms after the tap. Goalie mode: a tap before a real release makes the shooter let it go 120 ms later (fakes still release on time) (Claude, 2026-11-05; confirm) | The load has to happen before the release; scoring timing is unchanged |
| D41 | Reduced motion: the opponent goalie's reaction lands on the contact still frame, so the shot is exactly three stills; the result is announced to screen readers when the card appears; the vibration still fires at the tap (Claude, 2026-11-05) | Keeps reduced motion to three frames; announcements match what is on screen; the buzz confirms the tap |
| D42 | Wide shots from the middle row clip the pipe (within 4 px) for the post ping; other wide shots pass 20 px clear (Claude, 2026-11-05; confirm) | Gives the ping a predictable home without changing any result |

## Open questions

None right now. New questions go here, one at a time.

## Open items (art)

- Navy goalie poses: ready, high screen-left, high screen-right, low screen-left, low
  screen-right (D32)
- A right-side dive (navy and gray); top screen-right saves use a lunge until then
- Left-handed shooter sprites (navy and gray); goalie-mode mirrors and boys goalie-mode
  lefties wait on these (D30, D33)
- The girls sprite set; the girls field uses the code-drawn scene until then
- Shooter cue poses for goalie mode (hands high, hands low, sidearm, pump fake). Today
  the read comes from small body shifts on the cocked pose and the ball's flight
- The spare stick head (back view) is in the zip but unused

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

See the open items above. Plus:

- Approved USA Lacrosse logo files (SVG, light and dark backgrounds)
- Any source material for cues (coaching drills, goalie training guides)
