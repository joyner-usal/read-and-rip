// Ball flight as a pure function of time (ms since release). Frame px.
// Phase 1.6: bigger ball, eased flight with a slow-motion finish, a freeze frame on
// contact, a ground shadow so the arc reads, and goal, save and wide endings.
import type { Zone } from '../scenarios/types';
import { colIndex } from '../game/zones';
import { CONTACT_FREEZE_MS, FLIGHT_MS, NET_BULGE, REDUCED_FRAME_MS, flightProgress } from '../game/timing';
import { MOUTH, zoneCenter } from './manifest';
import type { ShotKind } from './poses';

export const R_NEAR = 10;
export const R_FAR = 5;
export const TRAIL_POINTS = 6;
const TRAIL_STEP_MS = 16;
/** Turf under the shooter's stick, and the goal line. */
const GROUND_NEAR = 760;
export const GROUND_GOAL = MOUTH.y + MOUTH.h + 4;
/** How long the ball stays after contact. */
export const AFTER_MS = 900;

export interface Pt { x: number; y: number }
export interface Shadow { x: number; y: number; rx: number; ry: number; alpha: number }
export interface BallFrame {
  x: number;
  y: number;
  r: number;
  alpha: number;
  /** Earlier positions, newest first. Empty in reduced motion. */
  trail: Pt[];
  /** True when the trail shows spin (a deflection). */
  spin: boolean;
  /** On the turf, straight below the ball. */
  shadow: Shadow | null;
  /** Contact effect: kind, where, and ms since the freeze frame ended (0 during it). */
  effect: { kind: ShotKind; at: Pt; age: number; frozen: boolean; ping: boolean } | null;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const quad = (p0: Pt, c: Pt, p1: Pt, k: number): Pt => ({
  x: (1 - k) * (1 - k) * p0.x + 2 * (1 - k) * k * c.x + k * k * p1.x,
  y: (1 - k) * (1 - k) * p0.y + 2 * (1 - k) * k * c.y + k * k * p1.y
});
const sideOf = (zone: Zone) => (colIndex(zone) === 0 ? 1 : colIndex(zone));

/** Where the flight ends: the zone, or past a pipe for a wide shot (clipping it if nearPost). */
export function shotTarget(zone: Zone, kind: ShotKind, nearPost = false): Pt {
  const p = zoneCenter(zone);
  if (kind !== 'wide') return p;
  const c = colIndex(zone);
  if (c === 0) return { x: p.x + 10, y: MOUTH.y - 18 }; // over the crossbar
  const gap = nearPost ? 4 : 20;
  return { x: c < 0 ? MOUTH.x - gap : MOUTH.x + MOUTH.w + gap, y: p.y };
}

/** Shadow on the turf below a ball at path progress u: smaller and fainter the higher it is. */
export function shadowAt(x: number, y: number, r: number, groundY: number): Shadow {
  const h = clamp01((groundY - y) / 300);
  return { x, y: groundY, rx: r * 1.6 * (1 - 0.45 * h), ry: r * 0.55 * (1 - 0.45 * h), alpha: 0.38 * (1 - 0.75 * h) };
}

export function ballAt(from: Pt, zone: Zone, kind: ShotKind, since: number, final: boolean, reduced: boolean, nearPost = false): BallFrame | null {
  if (since < 0) return null;
  const to = shotTarget(zone, kind, nearPost);
  const ctrl = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 80 };
  const flight = reduced ? 2 * REDUCED_FRAME_MS : FLIGHT_MS;
  const at = (u: number) => quad(from, ctrl, to, u);
  const groundAt = (u: number) => lerp(GROUND_NEAR, GROUND_GOAL, u);

  if (since < flight || !final) {
    let u = reduced ? (since < REDUCED_FRAME_MS ? 0 : 0.5) : flightProgress(since);
    if (!final) u = Math.min(u, 0.9);
    const p = at(u);
    const r = lerp(R_NEAR, R_FAR, u);
    const trail = reduced
      ? []
      : Array.from({ length: TRAIL_POINTS }, (_, i) => at(Math.min(u, flightProgress(since - TRAIL_STEP_MS * (i + 1))))).filter((q, i, all) => i === 0 || q.x !== all[i - 1].x);
    return { ...p, r, alpha: 1, trail, spin: false, shadow: shadowAt(p.x, p.y, r, groundAt(u)), effect: null };
  }

  const age = since - flight;
  if (age > AFTER_MS) return null;
  const frozen = !reduced && age < CONTACT_FREEZE_MS;
  const a = reduced ? 0 : Math.max(0, age - CONTACT_FREEZE_MS);
  const fade = reduced ? 1 : clamp01(1 - (age - 500) / (AFTER_MS - 500));
  const dir = sideOf(zone);
  const effect = { kind, at: to, age: a, frozen, ping: kind === 'wide' && nearPost };

  if (kind === 'goal') {
    // Into the net: pushes back with the bulge, then settles.
    const push = Math.sin(clamp01(a / NET_BULGE.ms) * Math.PI) * 4;
    const p = { x: to.x, y: to.y + 2 * clamp01(a / 300) - push * 0.3 };
    return { ...p, r: lerp(R_FAR, 4, clamp01(a / 300)), alpha: fade, trail: [], spin: false, shadow: shadowAt(p.x, p.y, 4, GROUND_GOAL), effect };
  }
  if (kind === 'save') {
    // Deflects off the stick head, up and out, spinning.
    const k = clamp01(a / 380);
    const c = { x: to.x + dir * 30, y: to.y - 85 };
    const end = { x: to.x + dir * 90, y: to.y - 70 };
    const p = quad(to, c, end, k);
    const trail = reduced
      ? []
      : Array.from({ length: TRAIL_POINTS }, (_, i) => {
          const q = quad(to, c, end, clamp01(k - 0.035 * (i + 1)));
          const wob = Math.sin((a - 18 * i) / 22) * 3; // spin wobble
          return { x: q.x + wob, y: q.y - wob * 0.5 };
        });
    return { ...p, r: lerp(R_FAR, 4, k), alpha: fade, trail, spin: !reduced, shadow: shadowAt(p.x, p.y, 4.5, GROUND_GOAL), effect };
  }
  // Wide: past the pipe, one bounce on the grass, then a roll toward the fence.
  const ground = GROUND_GOAL + 6;
  const bounceAt = { x: to.x + dir * 34, y: ground };
  const rollEnd = { x: to.x + dir * 110, y: ground - 70 };
  let p: Pt;
  if (reduced || a < 200) {
    const k = reduced ? 0 : a / 200;
    p = quad(to, { x: to.x + dir * 20, y: to.y - 10 }, bounceAt, k);
  } else if (a < 420) {
    const k = (a - 200) / 220;
    p = quad(bounceAt, { x: bounceAt.x + dir * 20, y: bounceAt.y - 26 }, { x: bounceAt.x + dir * 45, y: ground - 18 }, k);
  } else {
    const k = easeOut(clamp01((a - 420) / 420));
    const s = { x: bounceAt.x + dir * 45, y: ground - 18 };
    p = { x: lerp(s.x, rollEnd.x, k), y: lerp(s.y, rollEnd.y, k) };
  }
  const groundY = a < 420 ? ground : p.y;
  return { ...p, r: lerp(R_FAR, 3.4, clamp01(a / 800)), alpha: fade, trail: [], spin: false, shadow: shadowAt(p.x, p.y, 4, groundY), effect };
}

const easeOut = (k: number) => 1 - Math.pow(1 - k, 2);
