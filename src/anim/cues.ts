// Cue animation as data (SPEC.md section 8, Motion). Pure: given a scenario, its live
// timing and a time, return poses. The canvas code only draws what this returns.
//
// Coordinates are in "mouth space": x from -1 (shooter's left post) to 1 (right post),
// y from -1 (crossbar) to 1 (ground). Reduced motion snaps to each key pose instead
// of moving between them, so the cue shows as clear still frames.
import type { Scenario, Zone } from '../scenarios/types';
import type { Timing } from '../game/ramp';
import { colIndex, rowIndex } from '../game/zones';
import { releasePoint } from '../game/timing';

export interface GoaliePose {
  /** Body center, mouth space. */
  x: number;
  /** 0 standing tall, 1 deep crouch. */
  crouch: number;
  stickX: number;
  stickY: number;
}

export interface ShooterPose {
  /** Stick head position, mouth space (can sit outside the goal). */
  headX: number;
  headY: number;
  /** Shoulder line tilt in radians; drives hip turn and shoulder dip reads. */
  shoulderTilt: number;
}

export interface Key<P> {
  at: number;
  /** Time to blend in from the previous pose. */
  dur: number;
  pose: P;
}

export const NEUTRAL_GOALIE: GoaliePose = { x: 0, crouch: 0.3, stickX: 0.45, stickY: -0.55 };

/** A goalie pose that leaves `open` uncovered: body away from it, stick away from it. */
export function goalieOpening(open: Zone): GoaliePose {
  const c = colIndex(open);
  const r = rowIndex(open);
  const away = c === 0 ? 1 : -c; // center open: step to one side
  const x = c === 0 ? 0.5 : away * 0.42;
  if (r === -1) return { x, crouch: 0.85, stickX: away * 0.55, stickY: 0.45 }; // top open: low and stick down
  if (r === 1) return { x, crouch: 0, stickX: away * 0.5, stickY: -0.75 }; // low open: tall, stick high
  return { x, crouch: 0.4, stickX: away * 0.6, stickY: 0.05 };
}

export function goalieTimeline(s: Scenario, t: Timing): Key<GoaliePose>[] {
  const w = t.windowMs;
  if (s.mode === 'goalie') return [{ at: 0, dur: 0, pose: NEUTRAL_GOALIE }]; // you are the goalie
  if (s.fake && s.baitZone && t.closeMs !== undefined) {
    // Show the bait open fast, hold it, then close it at closeMs (which opens the real spot).
    const showBy = Math.min(t.closeMs * 0.5, w * 0.2);
    return [
      { at: 0, dur: 0, pose: NEUTRAL_GOALIE },
      { at: w * 0.05, dur: Math.max(60, showBy - w * 0.05), pose: goalieOpening(s.baitZone) },
      { at: t.closeMs, dur: Math.min(260, (w - t.closeMs) * 0.6), pose: goalieOpening(s.bestZone) }
    ];
  }
  return [
    { at: 0, dur: 0, pose: NEUTRAL_GOALIE },
    { at: w * 0.1, dur: w * 0.4, pose: goalieOpening(s.bestZone) }
  ];
}

/** Ready position on the shooter's hand side. */
export function shooterCarry(s: Scenario): ShooterPose {
  const side = s.shooterHand === 'right' ? 1 : -1;
  return { headX: side * 1.45, headY: 0.5, shoulderTilt: 0 };
}

/** Where the stick loads before the shot. Tells the goalie where it's going. */
export function shooterLoad(s: Scenario, target: Zone): ShooterPose {
  const side = s.shooterHand === 'right' ? 1 : -1;
  const r = rowIndex(target);
  const c = colIndex(target);
  switch (s.cueType) {
    case 'hands-high':
    case 'release-overhand':
      return { headX: side * 1.35, headY: -1.2, shoulderTilt: -side * 0.08 };
    case 'hands-low':
    case 'release-underhand':
      return { headX: side * 1.7, headY: 1.0, shoulderTilt: side * 0.18 };
    case 'release-sidearm':
      return { headX: side * 1.95, headY: 0.1, shoulderTilt: side * 0.05 };
    default: // hip-turn, shoulder-dip, fakes: the load follows the target
      return { headX: side * 1.5 + c * 0.15, headY: r * 0.9 - 0.3, shoulderTilt: c * 0.2 + r * side * 0.1 };
  }
}

/** Release time inside the window: releaseMs for fakes, otherwise 70% in. */
export function releaseAt(t: Timing): number {
  return releasePoint(t);
}

export function shooterTimeline(s: Scenario, t: Timing): Key<ShooterPose>[] {
  const carry = shooterCarry(s);
  if (s.mode === 'shooter') return [{ at: 0, dur: 0, pose: carry }]; // you are the shooter
  const rel = releaseAt(t);
  const load = shooterLoad(s, s.bestZone);
  // Follow through stays on the hand side so the stick never hides the goal; the ball shows the line.
  const side = s.shooterHand === 'right' ? 1 : -1;
  const follow: ShooterPose = { headX: side * 1.25 + colIndex(s.bestZone) * 0.15, headY: Math.min(1.2, load.headY + 0.6), shoulderTilt: -load.shoulderTilt };
  if (s.fake) {
    // Pump toward the other side, recover, then the real shot at releaseMs.
    const fakeTarget = (`${s.bestZone.split('-')[0]}-${colIndex(s.bestZone) === -1 ? 'right' : 'left'}`) as Zone;
    const pump = shooterLoad(s, fakeTarget);
    const pumpPose: ShooterPose = { headX: pump.headX * 0.6, headY: pump.headY, shoulderTilt: -pump.shoulderTilt * 1.5 };
    return [
      { at: 0, dur: 0, pose: carry },
      { at: rel * 0.15, dur: rel * 0.2, pose: pumpPose },
      { at: rel * 0.5, dur: rel * 0.25, pose: load },
      { at: rel, dur: 90, pose: follow }
    ];
  }
  return [
    { at: 0, dur: 0, pose: carry },
    { at: rel * 0.2, dur: rel * 0.6, pose: load },
    { at: rel, dur: 90, pose: follow }
  ];
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => k * k * (3 - 2 * k);

/** Pose at time t. Reduced motion snaps to a key's pose as soon as it starts. */
export function sample<P extends object>(keys: Key<P>[], t: number, reduced: boolean): P {
  let pose = keys[0].pose;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (t < k.at) break;
    if (reduced || k.dur <= 0 || t >= k.at + k.dur) {
      pose = k.pose;
      continue;
    }
    const f = ease((t - k.at) / k.dur);
    const from = pose as Record<string, number>;
    const to = k.pose as Record<string, number>;
    pose = Object.fromEntries(Object.keys(to).map(key => [key, lerp(from[key], to[key], f)])) as P;
    break;
  }
  return pose;
}

export interface BallState {
  x: number;
  y: number;
  /** 0 at the stick, 1 at the goal. */
  progress: number;
}

export const FLIGHT_MS = 320;

/** Goalie mode: the ball after release. Reduced motion shows it halfway, then at the goal. */
export function ballAt(s: Scenario, t: Timing, ms: number, reduced: boolean): BallState | null {
  if (s.mode !== 'goalie') return null;
  const rel = releaseAt(t);
  if (ms < rel) return null;
  let k = Math.min(1, (ms - rel) / FLIGHT_MS);
  if (reduced) k = k < 1 ? 0.5 : 1;
  const from = shooterLoad(s, s.bestZone);
  const tx = colIndex(s.bestZone) * (2 / 3);
  const ty = rowIndex(s.bestZone) * (2 / 3);
  return { x: lerp(from.headX, tx, k), y: lerp(from.headY, ty, k), progress: k };
}
