// Scoring for one rep (SPEC.md section 4). Pure: no clocks, no DOM.
import type { Mode, Zone } from '../scenarios/types';

export type Outcome = 'best' | 'good' | 'miss' | 'timeout' | 'early' | 'bait';

export const POINTS = { best: 3, good: 1, miss: 0, timeout: 0, early: -1, bait: 0, speedBonus: 1 } as const;

/** The parts of a rep that scoring needs, already scaled to the live read window. */
export interface RepTarget {
  mode: Mode;
  fake: boolean;
  bestZone: Zone;
  goodZones: Zone[];
  windowMs: number;
  /** Goalie fake: real release time inside the window. */
  releaseMs?: number;
  /** Shooter fake: the spot shown open. */
  baitZone?: Zone;
}

export interface Tap {
  zone: Zone;
  /** Ms from the start of the read window. */
  atMs: number;
}

export interface RepScore {
  outcome: Outcome;
  points: number;
  speedBonus: boolean;
}

export function scoreRep(rep: RepTarget, tap: Tap | null): RepScore {
  if (!tap) return { outcome: 'timeout', points: POINTS.timeout, speedBonus: false };

  if (rep.fake && rep.mode === 'goalie' && rep.releaseMs !== undefined && tap.atMs < rep.releaseMs) {
    return { outcome: 'early', points: POINTS.early, speedBonus: false };
  }
  if (rep.fake && rep.mode === 'shooter' && rep.baitZone && tap.zone === rep.baitZone) {
    return { outcome: 'bait', points: POINTS.bait, speedBonus: false };
  }

  const outcome: Outcome =
    tap.zone === rep.bestZone ? 'best' : rep.goodZones.includes(tap.zone) ? 'good' : 'miss';
  if (outcome === 'miss') return { outcome, points: POINTS.miss, speedBonus: false };

  const speedBonus = tap.atMs <= rep.windowMs / 2;
  return { outcome, points: POINTS[outcome] + (speedBonus ? POINTS.speedBonus : 0), speedBonus };
}

export const isScoring = (o: Outcome) => o === 'best' || o === 'good';

/** A round score never goes below 0. */
export function addToRound(total: number, points: number): number {
  return Math.max(0, total + points);
}
