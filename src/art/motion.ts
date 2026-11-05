// Where each player is drawn at a moment in the rep (Phase 1.6 motion pass). Pure.
// No crossfades: players travel along eased paths and swap sprites hard at the motion
// peak, with one faint smear copy for about 2 frames. Timing lives in game/timing.ts.
import type { Zone } from '../scenarios/types';
import type { ShotSchedule } from '../game/timing';
import {
  FLIGHT_MS, GOALIE_DIP_MS, GOALIE_LEAN_RAD, GOALIE_STRETCH, GOALIE_TRAVEL_MS, LATE_EXTRA_MS, LOAD_MS, LOAD_RISE, LOAD_ROT,
  LUNGE, PUSH_IN, REACTION_MS, SHAKE, SMEAR_MS, releasePoint
} from '../game/timing';
import { GOALIE_FEET, MOUTH, SHOOTER_HELMET, placeSprite, zoneCenter, type SpriteName } from './manifest';
import { colIndex } from '../game/zones';
import { READY, goalieCover, goalieSave, type ActorTarget, type RepView, type ShotPlan } from './poses';

export interface Pt { x: number; y: number }

/** One player as drawn: sprite, visual center, rotation and scale about the center. */
export interface Drawn {
  sprite: SpriteName;
  cx: number;
  cy: number;
  rot: number;
  scale: number;
  /** A faint copy drawn this far back along the motion, or null. */
  smear: Pt | null;
}

const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const easeInOutCubic = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);

/** Visual center of a target pose, in frame px. */
export function centerOf(t: ActorTarget): Pt {
  let ax: number;
  let ay: number;
  if (t.place === 'zone' && t.zone) {
    const z = zoneCenter(t.zone);
    ax = z.x + t.dx;
    ay = z.y + t.dy;
  } else if (t.place === 'helmet') {
    ax = SHOOTER_HELMET.x + t.dx;
    ay = SHOOTER_HELMET.y + t.dy;
  } else {
    ax = GOALIE_FEET.x + t.dx;
    ay = GOALIE_FEET.y + t.dy;
  }
  const b = placeSprite(t.sprite, ax, ay);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

export const still = (t: ActorTarget): Drawn => ({ sprite: t.sprite, ...pt(centerOf(t)), rot: t.rot, scale: t.scale, smear: null });
const pt = (p: Pt) => ({ cx: p.x, cy: p.y });

// ---------------- Goalie ----------------

export interface Move {
  to: ActorTarget;
  start: number;
  /** 'shift' repositions for a cue; 'save' is a dive or reach, with dip, lean and stretch. */
  kind: 'shift' | 'save';
  /** How far along the path the goalie gets (1 = all the way). */
  reach: number;
  /** For saves: the zone the stick goes to (sets the lean direction). */
  zone?: Zone;
}

/** The goalie's moves through a rep, in time order (rep time). */
export function goalieMoves(v: RepView, sched: ShotSchedule | null, shot: ShotPlan | null, reduced = false): Move[] {
  if (v.phase === 'setup') return [];
  const s = v.scenario;
  const moves: Move[] = [];
  if (v.mode === 'goalie') {
    // You are the goalie: you move the instant you tap.
    if (v.resolveMs !== null && v.tapped) moves.push({ to: goalieSave(v.tapped, 'navy'), start: v.resolveMs, kind: 'save', reach: 1, zone: v.tapped });
    return moves;
  }
  // Shooter mode: the opponent shows the cue...
  const w = v.timing.windowMs;
  const cueEnd = sched ? sched.releaseAt : Infinity;
  const cues: Move[] =
    s.fake && s.baitZone && v.timing.closeMs !== undefined
      ? [
          { to: goalieCover(s.baitZone), start: w * 0.05, kind: 'shift', reach: 1 },
          { to: goalieCover(s.bestZone), start: v.timing.closeMs, kind: 'shift', reach: 1 }
        ]
      : [{ to: goalieCover(s.bestZone), start: w * 0.1, kind: 'shift', reach: 1 }];
  moves.push(...cues.filter(m => m.start < cueEnd));
  // ...then reacts to the shot, a beat after release.
  if (shot && sched) {
    // Reduced motion: the reaction lands on the contact still frame, not a frame of its own.
    const react = reduced ? sched.contactAt : sched.releaseAt + REACTION_MS;
    const late = reduced ? 0 : LATE_EXTRA_MS;
    const z = shot.zone;
    if (shot.kind === 'save') moves.push({ to: goalieSave(z, 'gray'), start: react, kind: 'save', reach: 1, zone: z });
    if (shot.kind === 'goal') moves.push({ to: goalieSave(z, 'gray'), start: react + late, kind: 'save', reach: 1, zone: z });
    if (shot.kind === 'wide') moves.push({ to: goalieSave(z, 'gray'), start: react, kind: 'save', reach: 0.45, zone: z });
  }
  return moves;
}

/** Duration of a move, dip included. */
export const moveMs = (m: Move) => (m.kind === 'save' ? GOALIE_DIP_MS : 0) + GOALIE_TRAVEL_MS;

/** Evaluate one move from a starting pose. */
export function evalMove(from: Drawn, fromTarget: ActorTarget, m: Move, t: number, reduced: boolean): Drawn {
  const local = t - m.start;
  const to = still(m.to);
  if (local < 0) return from;
  if (reduced) return finalOf(from, fromTarget, m);
  const dip = m.kind === 'save' ? GOALIE_DIP_MS : 0;
  if (local < dip) {
    // Anticipation: a quick dip before the push.
    return { ...from, cy: from.cy + 5 * Math.sin((Math.PI * local) / dip), scale: from.scale * 0.98, smear: null };
  }
  const raw = clamp01((local - dip) / GOALIE_TRAVEL_MS);
  const e = easeInOutCubic(raw);
  const k = e * m.reach;
  const end = finalOf(from, fromTarget, m);
  const swapped = e >= 0.5;
  const swapAt = m.start + dip + travelTimeAt(0.5);
  const smearOn = swapped && t - swapAt < SMEAR_MS;
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;
  const len = Math.hypot(dx, dy) || 1;
  return {
    sprite: swapped ? m.to.sprite : from.sprite,
    cx: lerp(from.cx, to.cx, k),
    cy: lerp(from.cy, to.cy, k),
    rot: lerp(from.rot, end.rot, k),
    scale: lerp(from.scale, end.scale, k),
    smear: smearOn ? { x: (-dx / len) * 14, y: (-dy / len) * 14 } : null
  };
}

/** Time into the travel at which the eased progress reaches `e` (for the swap moment). */
function travelTimeAt(e: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (easeInOutCubic(mid) < e) lo = mid;
    else hi = mid;
  }
  return lo * GOALIE_TRAVEL_MS;
}

/** Where a move ends: at full reach a save leans toward the zone and stretches. */
function finalOf(from: Drawn, _fromTarget: ActorTarget, m: Move): Drawn {
  const to = still(m.to);
  if (m.kind !== 'save') return to;
  // Lean toward the zone's side (sprite centers can mislead: a dive's center sits mid-goal).
  const dir = m.zone ? colIndex(m.zone) : 0;
  const rot = dir === 0 ? m.to.rot : dir * Math.max(Math.abs(m.to.rot), GOALIE_LEAN_RAD);
  const scale = Math.max(m.to.scale, GOALIE_STRETCH);
  const k = m.reach;
  return { ...to, cx: lerp(from.cx, to.cx, k), cy: lerp(from.cy, to.cy, k), rot: lerp(from.rot, rot, k), scale: lerp(from.scale, scale, k) };
}

export function goalieAt(v: RepView, sched: ShotSchedule | null, shot: ShotPlan | null, reduced: boolean): Drawn {
  const moves = goalieMoves(v, sched, shot, reduced);
  let fromTarget = READY;
  let from = still(READY);
  const t = v.repMs;
  for (const m of moves) {
    if (t < m.start) break;
    const next = moves[moves.indexOf(m) + 1];
    if (next && t >= next.start) {
      // This move is done (or was cut short by the next one): take its end state.
      from = evalMove(from, fromTarget, m, Math.min(next.start, m.start + moveMs(m)), reduced);
      from = { ...from, smear: null };
      fromTarget = m.to;
      continue;
    }
    return evalMove(from, fromTarget, m, t, reduced);
  }
  return from;
}

// ---------------- Shooter ----------------

export function shooterAt(v: RepView, sched: ShotSchedule | null, reduced: boolean): Drawn {
  const team = v.mode === 'shooter' ? 'navy' : 'gray';
  const place = (sprite: SpriteName, dx = 0, dy = 0, rot = 0, scale = 1, smear: Pt | null = null): Drawn => ({
    sprite, ...pt(centerOf({ sprite, place: 'helmet', dx, dy, rot: 0, scale: 1 })), rot, scale, smear
  });
  if (v.phase === 'setup') return place(`shooter_${team}_carry`);
  const t = v.repMs;
  const cocked = cockedCue(v);
  if (!sched || t < sched.loadAt) return place(`shooter_${team}_cocked`, cocked.dx, cocked.dy, cocked.rot);
  if (t < sched.releaseAt) {
    // Load: the stick draws back and the body rises a touch.
    const e = reduced ? 0 : easeInOutCubic(clamp01((t - sched.loadAt) / LOAD_MS));
    return place(`shooter_${team}_cocked`, cocked.dx, cocked.dy - LOAD_RISE * e, cocked.rot + LOAD_ROT * e);
  }
  if (reduced) {
    return t < sched.contactAt ? place(`shooter_${team}_release`) : place(`shooter_${team}_follow`);
  }
  const back = { x: -LUNGE.dx * 1.5, y: -LUNGE.dy * 1.5 };
  if (t < sched.followAt) {
    // Release: hard swap with a forward lunge.
    const e = easeOutCubic(clamp01((t - sched.releaseAt) / 80));
    const smear = t - sched.releaseAt < SMEAR_MS ? back : null;
    return place(`shooter_${team}_release`, LUNGE.dx * e, LUNGE.dy * e, 0, lerp(1, LUNGE.scale, e), smear);
  }
  // Follow-through: the lunge settles back.
  const d = 1 - easeOutCubic(clamp01((t - sched.followAt) / 200));
  const smear = t - sched.followAt < SMEAR_MS ? back : null;
  return place(`shooter_${team}_follow`, LUNGE.dx * d, LUNGE.dy * d, 0, lerp(1, LUNGE.scale, d), smear);
}

/** Goalie mode: small body shifts carry the read until dedicated cue poses exist. */
function cockedCue(v: RepView): { dx: number; dy: number; rot: number } {
  if (v.mode === 'shooter') return { dx: 0, dy: 0, rot: 0 };
  const s = v.scenario;
  const rel = releasePoint(v.timing);
  if (s.fake && v.repMs > rel * 0.15 && v.repMs < rel * 0.5) {
    return s.cueType === 'head-fake' ? { dx: 8, dy: 0, rot: 0.04 } : { dx: -12, dy: 0, rot: -0.06 };
  }
  switch (s.cueType) {
    case 'hands-high':
    case 'release-overhand':
      return { dx: 0, dy: -6, rot: -0.04 };
    case 'hands-low':
    case 'release-underhand':
      return { dx: 0, dy: 6, rot: 0.05 };
    case 'release-sidearm':
      return { dx: 0, dy: 0, rot: 0.08 };
    default:
      return { dx: 0, dy: 0, rot: 0 };
  }
}

// ---------------- Camera ----------------

export interface Camera {
  /** Zoom about the goal (1 = none). */
  zoom: number;
  focus: Pt;
  shake: Pt;
}

export const GOAL_FOCUS: Pt = { x: MOUTH.x + MOUTH.w / 2, y: MOUTH.y + MOUTH.h / 2 };

/**
 * Slow push toward the goal through the read, eased back out over the flight, plus a
 * short shake on contact. Reduced motion: none of it.
 */
export function cameraAt(v: RepView, sched: ShotSchedule | null, shot: ShotPlan | null, reduced: boolean, ping = false): Camera {
  const none = { zoom: 1, focus: GOAL_FOCUS, shake: { x: 0, y: 0 } };
  if (reduced || v.phase === 'setup') return none;
  const w = v.timing.windowMs;
  const t = v.repMs;
  const pushStop = Math.min(sched?.releaseAt ?? Infinity, v.resolveMs ?? Infinity, w);
  const pushAt = (x: number) => PUSH_IN * easeInOutCubic(clamp01(x / w));
  let zoom = 1 + pushAt(Math.min(t, pushStop));
  if (sched && t > sched.releaseAt) {
    const peak = pushAt(pushStop);
    zoom = 1 + peak * (1 - easeInOutCubic(clamp01((t - sched.releaseAt) / FLIGHT_MS)));
  }
  let shake = { x: 0, y: 0 };
  if (sched && shot && shot.final) {
    const sh = shot.kind === 'goal' ? SHAKE.goal : shot.kind === 'save' ? SHAKE.save : ping ? SHAKE.post : null;
    const age = t - sched.contactAt;
    if (sh && age >= 0 && age < sh.ms) {
      const amp = sh.px * (1 - age / sh.ms);
      shake = { x: amp * Math.sin(age * 0.9), y: amp * Math.cos(age * 1.3) };
    }
  }
  return { zoom, focus: GOAL_FOCUS, shake };
}

/** Rep transition helper: blend from the last drawn pose into the new one. */
export function blendDrawn(a: Drawn, b: Drawn, k: number): Drawn {
  const e = easeInOutCubic(clamp01(k));
  return { sprite: e < 0.5 ? a.sprite : b.sprite, cx: lerp(a.cx, b.cx, e), cy: lerp(a.cy, b.cy, e), rot: lerp(a.rot, b.rot, e), scale: lerp(a.scale, b.scale, e), smear: null };
}

export type { Zone };
