// Which sprite each player shows, and where the ball goes, as pure functions of the
// rep. The renderer blends between whatever these return. Sprites are never mirrored:
// every pose is chosen by screen side so jersey numbers always read right.
import type { Mode, Scenario, Zone } from '../scenarios/types';
import type { Timing } from '../game/ramp';
import type { Outcome } from '../game/scoring';
import { colIndex, rowIndex } from '../game/zones';
import { releaseAt } from '../anim/cues';
import type { SpriteName } from './manifest';

export interface RepView {
  mode: Mode;
  phase: 'setup' | 'reading' | 'feedback';
  scenario: Scenario;
  timing: Timing;
  /** Ms since the read window opened. Negative in set up; keeps counting through feedback. */
  repMs: number;
  /** Ms into the window when the rep resolved (tap or timeout), or null while reading. */
  resolveMs: number | null;
  outcome: Outcome | null;
  tapped: Zone | null;
}

export interface ActorTarget {
  sprite: SpriteName;
  /** 'feet' places the anchor at the goalie's feet; 'zone' puts the stick pocket on a zone; 'helmet' is the shooter. */
  place: 'feet' | 'zone' | 'helmet';
  zone?: Zone;
  dx: number;
  dy: number;
  rot: number;
  scale: number;
}

const T = (sprite: SpriteName, place: ActorTarget['place'], over: Partial<ActorTarget> = {}): ActorTarget => ({ sprite, place, dx: 0, dy: 0, rot: 0, scale: 1, ...over });

export const READY = T('goalie_gray_ready_high_screenleft', 'feet');

/** A cue pose that leaves `open` uncovered (the goalie is wrong-footed toward the other side). */
export function goalieCover(open: Zone): ActorTarget {
  const c = colIndex(open);
  if (rowIndex(open) === -1) {
    // Top open: the goalie sits low, stick down on the far side.
    if (c === -1) return T('goalie_gray_low_screenright', 'feet', { dx: 12 });
    if (c === 1) return T('goalie_gray_low_screenleft', 'feet', { dx: -12 });
    return T('goalie_gray_low_screenleft', 'feet', { dx: -16 });
  }
  // Mid or low open: the goalie stands tall and leans away, stick high.
  if (c === -1) return T('goalie_gray_high_screenright', 'feet', { dx: 16 });
  if (c === 1) return T('goalie_gray_high_screenleft_lean', 'feet', { dx: -16 });
  return T('goalie_gray_high_screenright', 'feet', { dx: 26 });
}

/** The save pose that gets the stick to `z`. Navy only has the screen-left dive so far. */
export function goalieSave(z: Zone, team: 'gray' | 'navy'): ActorTarget {
  const c = colIndex(z);
  const r = rowIndex(z);
  if (r === -1) {
    if (c === -1) return T(team === 'navy' ? 'goalie_navy_dive_screenleft' : 'goalie_gray_dive_screenleft', 'zone', { zone: z });
    // No right-side dive yet: high screen-right plus a lunge.
    if (c === 1) return T('goalie_gray_high_screenright', 'feet', { dx: 22, dy: -10, rot: 0.14, scale: 1.06 });
    return T('goalie_gray_ready_high_screenleft', 'feet', { dx: 6, dy: -6 });
  }
  if (r === 0) {
    if (c === -1) return T('goalie_gray_high_screenleft_lean', 'feet', { dx: -10 });
    if (c === 1) return T('goalie_gray_high_screenright', 'feet', { dx: 10 });
    return READY;
  }
  if (c === 1) return T('goalie_gray_low_screenright', 'feet', { dx: 10 });
  return T('goalie_gray_low_screenleft', 'feet', { dx: c === -1 ? -10 : 8 });
}

export type ShotKind = 'goal' | 'save' | 'wide';

export interface ShotPlan {
  /** Rep time (ms into the window) when the ball leaves the stick. */
  startMs: number;
  /** Zone the ball heads for. */
  zone: Zone;
  kind: ShotKind;
  /** The rep has resolved, so the shot may finish. Before that the ball never quite arrives. */
  final: boolean;
}

/** Where the ball goes. Null until the shooter releases. */
export function shotPlan(v: RepView): ShotPlan | null {
  const s = v.scenario;
  const resolved = v.resolveMs !== null && v.outcome !== null;
  if (v.mode === 'shooter') {
    if (!resolved) return null; // you shoot when you tap (or at the buzzer)
    const startMs = v.resolveMs!;
    switch (v.outcome!) {
      case 'best':
      case 'good':
        return { startMs, zone: v.tapped!, kind: 'goal', final: true };
      case 'miss':
        return { startMs, zone: v.tapped!, kind: 'wide', final: true };
      case 'bait':
        return { startMs, zone: v.tapped!, kind: 'save', final: true }; // the goalie closed it
      default:
        return { startMs, zone: s.bestZone, kind: 'save', final: true }; // too late: the goalie is set
    }
  }
  // Goalie mode: the opponent shoots at the best zone at the release point.
  const release = releaseAt(v.timing);
  const startMs = resolved && !s.fake ? Math.min(release, v.resolveMs!) : release;
  if (v.repMs < startMs) return null;
  if (!resolved) return { startMs, zone: s.bestZone, kind: 'goal', final: false };
  const saved = v.outcome === 'best' || v.outcome === 'good';
  return { startMs, zone: saved ? v.tapped! : s.bestZone, kind: saved ? 'save' : 'goal', final: true };
}

export const RELEASE_HOLD_MS = 110;

export function goalieTarget(v: RepView): ActorTarget {
  const s = v.scenario;
  if (v.phase === 'setup') return READY;
  if (v.mode === 'goalie') {
    // You are the goalie: hold ready, then go where you tapped.
    if (v.resolveMs === null || !v.tapped) return READY;
    return goalieSave(v.tapped, 'navy');
  }
  // Shooter mode: the opponent shows the cue, then reacts to your shot.
  const shot = shotPlan(v);
  if (shot && shot.kind === 'save' && v.repMs >= shot.startMs + 60) return goalieSave(shot.zone, 'gray');
  const w = v.timing.windowMs;
  const t = v.resolveMs !== null ? Math.max(v.repMs, v.resolveMs) : v.repMs;
  if (s.fake && s.baitZone && v.timing.closeMs !== undefined) {
    if (t < w * 0.05) return READY;
    return t < v.timing.closeMs ? goalieCover(s.baitZone) : goalieCover(s.bestZone);
  }
  return t < w * 0.1 ? READY : goalieCover(s.bestZone);
}

export function shooterTarget(v: RepView): ActorTarget {
  const team = v.mode === 'shooter' ? 'navy' : 'gray';
  const carry = T(`shooter_${team}_carry`, 'helmet');
  if (v.phase === 'setup') return carry;
  const shot = shotPlan(v);
  if (shot && v.repMs >= shot.startMs) {
    return T(v.repMs < shot.startMs + RELEASE_HOLD_MS ? `shooter_${team}_release` : `shooter_${team}_follow`, 'helmet');
  }
  if (v.mode === 'shooter') return T('shooter_navy_cocked', 'helmet');
  // Goalie mode: the read is in the shooter. Small body shifts stand in until more poses exist.
  const s = v.scenario;
  const rel = releaseAt(v.timing);
  if (s.fake && v.repMs > rel * 0.15 && v.repMs < rel * 0.5) {
    return T('shooter_gray_cocked', 'helmet', s.cueType === 'head-fake' ? { dx: 8, rot: 0.04 } : { dx: -12, rot: -0.06 });
  }
  switch (s.cueType) {
    case 'hands-high':
    case 'release-overhand':
      return T('shooter_gray_cocked', 'helmet', { dy: -6, rot: -0.04 });
    case 'hands-low':
    case 'release-underhand':
      return T('shooter_gray_cocked', 'helmet', { dy: 6, rot: 0.05 });
    case 'release-sidearm':
      return T('shooter_gray_cocked', 'helmet', { rot: 0.08 });
    default:
      return T('shooter_gray_cocked', 'helmet');
  }
}
