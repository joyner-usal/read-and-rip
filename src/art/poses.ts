// Which sprite each player shows, and where the ball goes, as pure functions of the
// rep. The renderer blends between whatever these return. Sprites are never mirrored:
// every pose is chosen by screen side so jersey numbers always read right.
import type { Mode, Scenario, Zone } from '../scenarios/types';
import type { Timing } from '../game/ramp';
import type { Outcome } from '../game/scoring';
import { colIndex, rowIndex } from '../game/zones';
import { shotSchedule } from '../game/timing';
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
  /** Rep time when the ball leaves the stick. */
  startMs: number;
  /** Rep time of contact (net, stick, or turf past the pipe). */
  contactAt: number;
  /** Zone the ball heads for. */
  zone: Zone;
  kind: ShotKind;
  /** The rep has resolved, so the shot may finish. Before that the ball never quite arrives. */
  final: boolean;
  /** A wide shot that clips a pipe on its way past (a small post ping). */
  nearPost: boolean;
}

/** Where and when the ball goes. Null while there is no shot to plan yet. */
export function shotPlan(v: RepView, reduced = false): ShotPlan | null {
  const s = v.scenario;
  const resolved = v.resolveMs !== null && v.outcome !== null;
  if (v.mode === 'shooter' && !resolved) return null; // you shoot when you tap (or at the buzzer)
  const sched = shotSchedule(v.mode, s.fake, v.timing, resolved ? v.resolveMs : null, reduced);
  const base = { startMs: sched.releaseAt, contactAt: sched.contactAt, nearPost: false };
  if (v.mode === 'shooter') {
    switch (v.outcome!) {
      case 'best':
      case 'good':
        return { ...base, zone: v.tapped!, kind: 'goal', final: true };
      case 'miss':
        // Middle-row misses clip the pipe on the way past.
        return { ...base, zone: v.tapped!, kind: 'wide', final: true, nearPost: rowIndex(v.tapped!) === 0 && colIndex(v.tapped!) !== 0 };
      case 'bait':
        return { ...base, zone: v.tapped!, kind: 'save', final: true }; // the goalie closed it
      default:
        return { ...base, zone: s.bestZone, kind: 'save', final: true }; // too late: the goalie is set
    }
  }
  // Goalie mode: the opponent shoots at the best zone.
  if (!resolved) return { ...base, zone: s.bestZone, kind: 'goal', final: false };
  const saved = v.outcome === 'best' || v.outcome === 'good';
  return { ...base, zone: saved ? v.tapped! : s.bestZone, kind: saved ? 'save' : 'goal', final: true };
}
