// Scenario types. Mirrors schemas/scenario.schema.json; the validator
// (scripts/validate-scenarios.mjs) is the source of truth for content.

export type Game = 'boys' | 'girls';
export type Mode = 'shooter' | 'goalie';
export type Hand = 'right' | 'left';

/**
 * The nine goal zones, named from the shooter's view (the only camera in
 * the game). Row: top, mid, low. Column: left, center, right.
 * The shooter's left is the goalie's right; SPEC.md covers how labels read.
 */
export const ZONES = [
  'top-left', 'top-center', 'top-right',
  'mid-left', 'mid-center', 'mid-right',
  'low-left', 'low-center', 'low-right'
] as const;
export type Zone = (typeof ZONES)[number];

/** What the player is reading. Shooter mode reads the goalie; goalie mode reads the shooter. */
export const SHOOTER_CUES = [
  'goalie-off-angle',
  'goalie-stick-high',
  'goalie-stick-low',
  'goalie-weight-shift',
  'goalie-low-stance',
  'goalie-early-drop'
] as const;
export const GOALIE_CUES = [
  'hands-high',
  'hands-low',
  'hip-turn',
  'shoulder-dip',
  'release-sidearm',
  'release-overhand',
  'release-underhand',
  'stick-fake',
  'head-fake'
] as const;
export type CueType = (typeof SHOOTER_CUES)[number] | (typeof GOALIE_CUES)[number];

export interface Scenario {
  schemaVersion: 1;
  id: string;
  game: Game;
  mode: Mode;
  /** Degrees from straight on. 0 = top center, negative = shooter's left side of the field. */
  approachAngleDeg: number;
  shooterHand: Hand;
  cueType: CueType;
  fake: boolean;
  /** Time the cue plays and the tap is open, in ms. */
  readWindowMs: number;
  /** For fakes only: ms into the window when the real shot is released. A goalie tap before this is an early tap. */
  releaseMs?: number;
  bestZone: Zone;
  goodZones: Zone[];
  /** 1 (easiest) to 5. Drives the difficulty ramp. */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Plain-English coaching note shown after the rep, with the rule or principle behind it. */
  rulesNote: string;
  /** Workflow state. Only "approved" scenarios ship. */
  status: 'draft' | 'approved';
}
