# Read and Rip: Game Spec

Version 0.2, Phase 1, 2026-11-04. Owner: USA Lacrosse, Digital Learning and Education.
Anything marked **(open)** waits on a decision listed in `BUILD.md`.

## 1. The game in one line

Read the cue, then tap the spot on a 3x3 goal grid before time runs out. Shooters
pick the best place to put the ball. Goalies pick the zone to save.

Anyone can play. No account, no sign-in, no personal information. Scores stay on the device.

## 2. One view for both modes

The camera always sits behind the shooter's stick, looking at the goal. The shooter's
stick is in the foreground on the shooter's hand side. The goalie stands in the cage.

- **Shooter mode:** you are the shooter. You read the goalie (stick position, weight,
  stance, angle) and pick where to shoot.
- **Goalie mode:** you see the same shot from the same spot, but you play the goalie.
  You read the shooter's hands, hips, shoulders and release, and pick the save zone.

Keeping one view means one renderer, one grid, and one set of art. It also means
goalie players read the shot the way a shooter sees it.

### Zone names

The nine zones are always named **from the shooter's view**, in both modes:

| | Left | Center | Right |
| --- | --- | --- | --- |
| **Top** | top-left (1) | top-center (2) | top-right (3) |
| **Mid** | mid-left (4) | mid-center (5) | mid-right (6) |
| **Low** | low-left (7) | low-center (8) | low-right (9) |

The shooter's left is the goalie's right. In goalie mode, feedback text names both, for
example: "Low right (your low left as the goalie)." Numbers are the keyboard keys.

### Packs

At start the player picks **Boys** or **Girls**. The pack sets which scenarios load and
pack-specific field details (crease, markings, rules notes). Both packs use the same
grid, scoring and screens. Field details per pack get confirmed against the rulebooks
before content is approved **(open)**.

## 3. Game loop

```
Start screen  ->  Round (30 s clock)  ->  Round summary  ->  Play again / Change pack or mode
                     |
                     +-> Rep: set up -> read window (cue plays, tap open) -> feedback -> next rep
```

### Round

- A round runs on one **30-second clock**, like a shot clock. Reps run back to back
  until the clock hits zero. (Decided 2026-11-04, BUILD.md D12.)
- The clock **pauses during feedback** so reading the result never costs time.
- If the clock hits zero mid-rep, that rep plays out and counts (a buzzer beater).
- The player can pause. Pausing hides the field so the cue can't be studied on pause.

### Rep

1. **Set up** (about 600 ms): shooter's approach angle and hand appear. Tapping is closed.
2. **Read window** (`readWindowMs`, scaled by level): the cue plays. The grid is open.
   The first tap locks in the answer. One tap per rep.
3. **Resolve:** best, good, miss, timeout (no tap), early (goalie fake) or took the
   bait (shooter fake).
4. **Feedback:** result word, icon, points, the tapped zone and the best zone outlined.
   In a timed round it lasts about 1.2 s (tap to skip) and the clock is stopped. In
   Practice mode it waits for Continue and always shows the `rulesNote`.

Scenarios don't repeat inside a round until the eligible pool runs out. Mirrored copies
(section 6) count as their own scenarios.

### Fakes (D15)

Fakes appear in both modes, only at ramp level 3 and up.

- **Shooter mode:** the goalie shows an open spot (`baitZone`), then closes it at
  `closeMs`. The real best spot opens as the goalie moves. Tapping `baitZone` at any time
  is **Took the bait, 0**.
- **Goalie mode:** the shooter fakes first (stick fake or head fake), then releases the
  real shot at `releaseMs`. Any tap before `releaseMs` is **Bit on the fake, -1**.

### Practice mode (D17)

No round clock, no ramp, read windows doubled, and the rules note after every rep. The
player ends the session with an End button. Practice draws from every difficulty,
fakes included, without repeats until the pool runs out. Practice scores go into
history but never count as bests.

### Round summary

Score, personal best for that pack and mode (and whether this round beat it), reps
played, best and good counts, and the rules notes from every rep that didn't score so
the player can learn from them.

## 4. Scoring

| Result | Points | When |
| --- | --- | --- |
| Best | **+3** | Tapped `bestZone` |
| Good | **+1** | Tapped one of `goodZones` |
| Miss | **0** | Tapped any other zone |
| Timeout | **0** | No tap before the read window closed |
| Speed bonus | **+1** | Added to a best or good tap made in the first half of the read window (BUILD.md D14; tune after playtests) |
| Early tap on a fake | **-1** | Goalie mode fake. Any tap before `releaseMs` |
| Took the bait | **0** | Shooter mode fake. Tapped `baitZone` (D15) |

- Highest single rep: 4 (best plus speed bonus).
- An early tap ends the rep: the goalie bit on the fake. No speed bonus.
- In a shooter fake, tapping the best zone before the goalie closes the bait still
  counts as best: the shooter read past the bait.
- A round score never goes below 0.
- Response time is measured from the start of the read window to the tap, using
  `performance.now()` and the tap's `pointerdown`, not `click`, to cut input lag.

## 5. Difficulty ramp

Each scenario has a `difficulty` from 1 to 5. Each round starts at level 1.

| Level | Scenarios drawn from | Read window scale | Fakes |
| --- | --- | --- | --- |
| 1 | difficulty 1 | 1.00 | No |
| 2 | difficulty 1 to 2 | 0.90 | No |
| 3 | difficulty 2 to 3 | 0.80 | Yes |
| 4 | difficulty 3 to 4 | 0.70 | Yes |
| 5 | difficulty 4 to 5 | 0.60 | Yes |

- **Up a level** after 3 scoring reps in a row (best or good).
- **Down a level** after 2 non-scoring reps in a row (miss, timeout, early or took
  the bait).
- Scaled read windows never drop below 400 ms. `releaseMs` and `closeMs` scale with
  the window so they stay at the same point in the cue.
- The **Longer read windows** setting multiplies on top (x1.5). Practice doubles (x2).
- If a level's pool is empty, draw from the nearest level that has scenarios.
- Practice mode turns the ramp and the round clock off (D17).

## 6. Scenario data

One JSON file per scenario in `scenarios/boys/` or `scenarios/girls/`, named `<id>.json`.
Schema: `schemas/scenario.schema.json`. Check with `npm run validate`.

| Field | Type | Notes |
| --- | --- | --- |
| `schemaVersion` | `1` | Bump when the shape changes |
| `id` | string | `<game>-<mode>-<slug>`, matches the file name |
| `game` | `boys` or `girls` | Must match the folder |
| `mode` | `shooter` or `goalie` | |
| `approachAngleDeg` | number, -75 to 75 | 0 is straight on. Negative is the shooter's left side of the field |
| `shooterHand` | `right` or `left` | Sets which side the foreground stick is on |
| `cueType` | enum | Shooter mode reads the goalie (`goalie-*`). Goalie mode reads the shooter (`hands-high`, `hip-turn`, `stick-fake` and so on) |
| `fake` | boolean | Either mode (D15). Only drawn at ramp level 3 and up |
| `readWindowMs` | integer, 400 to 4000 | Before level scaling |
| `releaseMs` | integer | Goalie mode fakes only. When the real shot leaves the stick |
| `baitZone` | zone | Shooter mode fakes only. The spot the goalie shows open. Can't be the best or a good zone |
| `closeMs` | integer | Shooter mode fakes only. When the goalie closes `baitZone`. Inside the read window |
| `mirror` | boolean, default `true` | Set `false` to opt out of the left to right copy (D16) |
| `bestZone` | zone | |
| `goodZones` | zone list, 0 to 4 | Can't include `bestZone` |
| `difficulty` | 1 to 5 | Drives the ramp |
| `rulesNote` | string, 10 to 280 chars | Plain English. Shown after the rep. No em dashes |
| `status` | `draft` or `approved` | Only approved scenarios ship. `npm run validate -- --strict` fails on drafts |

`schemaVersion`, `releaseMs`, `difficulty` and `status` were added to the requested
field list; `BUILD.md` explains why. `baitZone`, `closeMs` and `mirror` came with D15
and D16.

The validator also checks: file folder matches `game`, file name matches `id`, cue type
fits the mode, fake timing fields match the mode, `releaseMs` and `closeMs` sit inside
the read window, no duplicate ids, and no id ending in `-m` (that suffix is for mirrors).

### Mirroring (D16)

Every scenario gets a left to right copy unless it sets `mirror: false`. The copy flips
`approachAngleDeg`, `shooterHand`, `bestZone`, `goodZones` and `baitZone`, gets the id
suffix `-m`, and counts in the pool. The validator **warns** (it doesn't fail) when a
mirrored scenario's `rulesNote` uses a side word (left, right, strong hand, weak hand,
hash, wing, near side, far side), so a reviewer checks the note still reads true when
flipped.

## 7. Saved data (device only)

One `localStorage` key, `readandrip:v1`. Every read and write is wrapped so a private
window or full storage never stops play; the game just won't remember.

```json
{
  "version": 1,
  "profile": {
    "localId": "f2c1...uuid",
    "accountId": null,
    "createdAt": "2026-11-04T16:00:00.000Z"
  },
  "settings": {
    "game": "girls",
    "mode": "goalie",
    "reducedMotion": "system",
    "sound": true,
    "haptics": true,
    "longerWindows": false
  },
  "sessions": [
    {
      "id": "9a7e...uuid",
      "ownerId": "f2c1...uuid",
      "game": "girls",
      "mode": "goalie",
      "startedAt": "2026-11-04T16:01:00.000Z",
      "endedAt": "2026-11-04T16:01:34.000Z",
      "score": 17,
      "reps": [
        { "scenarioId": "girls-goalie-sample-001", "tappedZone": "low-right",
          "outcome": "best", "responseMs": 640, "points": 4 }
      ],
      "practice": false,
      "longerWindows": false,
      "contentVersion": "3f9c1a2b",
      "syncedAt": null
    }
  ],
  "bests": {
    "girls:goalie": { "score": 17, "sessionId": "9a7e...uuid", "at": "2026-11-04T16:01:34.000Z" }
  }
}
```

**Ready for accounts later:**

- Every record has a stable `id`, an `ownerId`, and timestamps.
- `syncedAt: null` marks what hasn't been uploaded. On first sign-in: set
  `profile.accountId`, upload sessions where `syncedAt` is null, stamp them, and merge
  `bests` by taking the higher score.
- `contentVersion` (a short hash of the scenario files) keeps old scores comparable
  when scenarios change.
- Practice sessions are saved with `practice: true` and never set a best. Rounds played
  with Longer read windows keep their own bests under keys like `girls:goalie:long`.
- History keeps the last 50 sessions. Bests are kept separately, so trimming never
  loses a best.
- Types live in `src/storage/schema.ts`. Today an unknown `version` starts fresh.
  Once real players have data, every version bump gets a migration instead.

Nothing personal is stored: no name, email, birth date or location. This keeps v1 simple
for a youth audience.

## 8. Accessibility

Target: WCAG 2.2 AA where it applies to a timed game.

### Motion

- Respects `prefers-reduced-motion`. An in-app setting overrides it (System, On, Off).
- With reduced motion on: the cue plays as clear still key frames instead of motion,
  no screen shake, no zooms, no confetti. Duration tokens drop to 0 ms.
- Nothing flashes more than 3 times a second, in any setting.

### Feedback never by color alone

Every result has a word, an icon shape, and the points as text:

| Result | Icon | Text |
| --- | --- | --- |
| Best | Star | "Best +3" |
| Good | Check mark | "Good +1" |
| Miss | X | "Miss 0" |
| Timeout | Clock | "Too late 0" |
| Early on a goalie fake | Open hand | "Bit on the fake -1" |
| Bait on a shooter fake | Hook | "Took the bait 0" |

- The best zone is shown with a thick solid outline and a label, not a fill color.
- Selected chips and zones use a check mark or dot plus fill, not color only.
- Sound and haptics are extras, never the only signal.

### Input and reading

- The grid is nine real buttons over the canvas, so it works with touch, mouse,
  keyboard, switch access and screen readers. The canvas is decorative (`aria-hidden`).
- Keys 1 to 9 pick zones in reading order. Space or Enter starts and continues.
- Tap targets are at least 48 by 48 px (`--rr-tap-min`).
- Results are announced in a polite live region. The clock is announced at 10 and 5
  seconds only, not every second.
- Works in portrait and landscape. Text scales with browser zoom up to 200%.

### Contrast

Measured against the brand colors:

| Pair | Ratio | Use |
| --- | --- | --- |
| Navy on off-white | 14.74:1 | All body text |
| White on red | 3.88:1 | Large bold text only (buttons at 20 px heavy) |
| Red on off-white | 3.64:1 | Accents, rules, icons, large display text. Never body text |
| White on turf | 6.39:1 | Field labels |

### Timing

The 30-second clock is part of the game, so it stays in the main mode. To give
everyone a way in:

- **Practice mode** (in v1, D17): no round clock, no ramp, read windows doubled, rules
  note after every rep. Feedback waits for Continue.
- **Longer read windows** setting: multiplies every read window by 1.5. Scores in this
  setting are kept apart from regular bests.

## 9. Brand and art rules

- Colors live only in `brand/tokens.css`. Components use the `--rr-*` variables; canvas
  code reads them through `token()` in `src/ui/theme.ts`. Exceptions that can't read CSS:
  the PWA manifest colors, the `theme-color` meta tag, and the icon SVG.
- Display type: Vanguard CF. Body: Mundial. Fallbacks are in the font stacks.
- Flat and square, in line with usalacrosse.com.
- No AI imagery. All art is drawn in code (canvas or SVG). Missing logo or photos use
  dashed, labeled placeholders.
- No em dashes or double hyphens in any player-facing copy or rules note. The validator
  enforces this for rules notes.
