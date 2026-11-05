// Ball flight as a pure function of time (ms since release). Frame px.
import type { Zone } from '../scenarios/types';
import { colIndex } from '../game/zones';
import { MOUTH, zoneCenter } from './manifest';
import type { ShotKind } from './poses';

export const FLIGHT_MS = 320;
export const AFTER_MS = 600;
const R_NEAR = 7;
const R_FAR = 3.2;

export interface Pt { x: number; y: number }
export interface BallFrame {
  x: number;
  y: number;
  r: number;
  alpha: number;
  /** Earlier positions, newest first, for the motion trail. Empty in reduced motion. */
  trail: Pt[];
  /** Effect at the goal: kind and ms since the ball arrived. */
  effect: { kind: ShotKind; at: Pt; age: number } | null;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const quad = (p0: Pt, c: Pt, p1: Pt, k: number): Pt => ({
  x: (1 - k) * (1 - k) * p0.x + 2 * (1 - k) * k * c.x + k * k * p1.x,
  y: (1 - k) * (1 - k) * p0.y + 2 * (1 - k) * k * c.y + k * k * p1.y
});

/** Where the ball ends the flight: the zone, or just outside a pipe for a wide shot. */
export function shotTarget(zone: Zone, kind: ShotKind): Pt {
  const p = zoneCenter(zone);
  if (kind !== 'wide') return p;
  const c = colIndex(zone);
  if (c === 0) return { x: p.x + 10, y: MOUTH.y - 18 }; // over the crossbar
  return { x: c < 0 ? MOUTH.x - 20 : MOUTH.x + MOUTH.w + 20, y: p.y };
}

const sideOf = (zone: Zone) => (colIndex(zone) === 0 ? 1 : colIndex(zone));

/**
 * @param from   the stick pocket at release
 * @param since  ms since release
 * @param final  false while the rep is unresolved: the ball never quite arrives
 */
export function ballAt(from: Pt, zone: Zone, kind: ShotKind, since: number, final: boolean, reduced: boolean): BallFrame | null {
  if (since < 0) return null;
  const to = shotTarget(zone, kind);
  const ctrl = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 70 };
  const pathAt = (k: number) => {
    const p = quad(from, ctrl, to, k);
    return { ...p, r: lerp(R_NEAR, R_FAR, k) };
  };

  let k = Math.min(1, since / FLIGHT_MS);
  if (!final) k = Math.min(k, 0.9);
  if (k < 1) {
    if (reduced) k = 0.5; // one still frame mid-flight
    const p = pathAt(k);
    const trail = reduced ? [] : [1, 2, 3, 4].map(i => quad(from, ctrl, to, Math.max(0, k - 0.05 * i)));
    return { ...p, alpha: 1, trail, effect: null };
  }

  const age = since - FLIGHT_MS;
  if (age > AFTER_MS) return null;
  const fade = reduced ? 1 : 1 - age / AFTER_MS;
  const a = reduced ? 1 : Math.min(1, age / 320);
  const dir = sideOf(zone);
  if (kind === 'goal') {
    // Into the net: settles a touch deeper and smaller.
    return { x: to.x, y: to.y + 2 * a, r: lerp(R_FAR, 2.6, a), alpha: fade, trail: [], effect: { kind, at: to, age } };
  }
  if (kind === 'save') {
    // Deflects off the stick head, up and out.
    const end = { x: to.x + dir * 70, y: to.y - 60 };
    const p = quad(to, { x: to.x + dir * 20, y: to.y - 70 }, end, a);
    return { ...p, r: lerp(R_FAR, 2.6, a), alpha: fade, trail: [], effect: { kind, at: to, age } };
  }
  // Wide: skips on the turf beyond the pipe.
  const ground = { x: to.x + dir * 50, y: MOUTH.y + MOUTH.h + 4 };
  const end = { x: to.x + dir * 95, y: MOUTH.y + MOUTH.h - 2 };
  const p = a < 0.5 ? quad(to, { x: to.x + dir * 25, y: to.y }, ground, a * 2) : quad(ground, { x: ground.x + dir * 22, y: ground.y - 22 }, end, (a - 0.5) * 2);
  return { ...p, r: lerp(R_FAR, 2.4, a), alpha: fade, trail: [], effect: { kind, at: to, age } };
}
