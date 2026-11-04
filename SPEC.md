# Read and Rip: Game Spec

Version 0.1, Phase 0 draft, 2026-11-04. Owner: USA Lacrosse, Digital Learning and Education.
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
3. **Resolve:** best, good, miss, timeout (no tap), or early (goalie mode fakes only).
4. **Feedback** (about 1.2 s, or until tapped): result word, icon, points, the best zone
   outlined, and the scenario's `rulesNote`.

Scenarios don't repeat inside a round until the eligible pool runs out.

### Round summary

Score, personal best for that pack and mode, reps played, best and good counts, and
the rules notes from missed reps so the player can learn from them.

## 4. Scoring

| Result | Points | When |
| --- | --- | --- |
| Best | **+3** | Tapped `bestZone` |
| Good | **+1** | Tapped one of `goodZones` |
| Miss | **0** | Tapped any other zone |
| Timeout | **0** | No tap before the read window closed |
| Speed bonus | **+1** | Added to a best or good tap made in the first half of the read window **(open: threshold and value)** |
| Early tap on a fake | **-1** | Goalie mode only. Scenario has `fake: true` and the tap came before `releaseMs` |

- Highest single rep: 4 (best plus speed bonus).
- An early tap ends the rep: the goalie bit on the fake. No speed bonus.
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
- **Down a level** after 2 non-scoring reps in a row (miss, timeout or early).
- Scaled read windows never drop below 400 ms.
- If a level's pool is empty, draw from the nearest level that has scenarios.
- Practice mode (recommended, see Accessibility) turns the ramp and the round clock off.

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
| `fake` | boolean | Goalie mode only in v1 |
| `readWindowMs` | integer, 400 to 4000 | Before level scaling |
| `releaseMs` | integer | Fakes only. When the real shot leaves the stick |
| `bestZone` | zone | |
| `goodZones` | zone list, 0 to 4 | Can't include `bestZone` |
| `difficulty` | 1 to 5 | Drives the ramp |
| `rulesNote` | string, 10 to 280 chars | Plain English. Shown after the rep. No em dashes |
| `status` | `draft` or `approved` | Only approved scenarios ship. `npm run validate -- --strict` fails on drafts |

`schemaVersion`, `releaseMs`, `difficulty` and `status` were added to the requested
field list; `BUILD.md` explains why.

The validator also checks: file folder matches `game`, file name matches `id`, cue type
fits the mode, `releaseMs` sits inside the read window, and no duplicate ids.

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
    "haptics": true
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
      "contentVersion": "0.1.0",
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
- `contentVersion` keeps old scores comparable when scenarios change.
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
| Early on a fake | Open hand | "Bit on the fake -1" |

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

- **Practice mode** (recommended for v1): no round clock, no ramp, read windows
  doubled, rules note after every rep.
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
