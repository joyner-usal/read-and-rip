// Difficulty ramp (SPEC.md section 5) and scenario picking. Pure.
import type { Scenario } from '../scenarios/types';
import { isScoring, type Outcome } from './scoring';
import { nextRandom } from './rng';

export type Level = 1 | 2 | 3 | 4 | 5;

export const LEVELS: Record<Level, { difficulties: number[]; scale: number; fakes: boolean }> = {
  1: { difficulties: [1], scale: 1.0, fakes: false },
  2: { difficulties: [1, 2], scale: 0.9, fakes: false },
  3: { difficulties: [2, 3], scale: 0.8, fakes: true },
  4: { difficulties: [3, 4], scale: 0.7, fakes: true },
  5: { difficulties: [4, 5], scale: 0.6, fakes: true }
};

export const UP_AFTER = 3;
export const DOWN_AFTER = 2;
export const MIN_WINDOW_MS = 400;
export const PRACTICE_SCALE = 2;
export const LONGER_WINDOWS_SCALE = 1.5;

export interface RampState {
  level: Level;
  scoringStreak: number;
  missStreak: number;
}

export const startRamp = (): RampState => ({ level: 1, scoringStreak: 0, missStreak: 0 });

export function updateRamp(r: RampState, outcome: Outcome): RampState {
  if (isScoring(outcome)) {
    const streak = r.scoringStreak + 1;
    if (streak >= UP_AFTER && r.level < 5) return { level: (r.level + 1) as Level, scoringStreak: 0, missStreak: 0 };
    return { level: r.level, scoringStreak: streak, missStreak: 0 };
  }
  const streak = r.missStreak + 1;
  if (streak >= DOWN_AFTER && r.level > 1) return { level: (r.level - 1) as Level, scoringStreak: 0, missStreak: 0 };
  return { level: r.level, scoringStreak: 0, missStreak: streak };
}

export interface Timing {
  windowMs: number;
  releaseMs?: number;
  closeMs?: number;
}

/**
 * Live timing for a rep. `multiplier` is the level scale, times 1.5 for Longer read
 * windows, or 2 in Practice. Fake times move with the window so they stay at the same
 * point in the cue.
 */
export function scaleTiming(s: Scenario, multiplier: number): Timing {
  const windowMs = Math.max(MIN_WINDOW_MS, Math.round(s.readWindowMs * multiplier));
  const k = windowMs / s.readWindowMs;
  const t: Timing = { windowMs };
  if (s.releaseMs !== undefined) t.releaseMs = Math.round(s.releaseMs * k);
  if (s.closeMs !== undefined) t.closeMs = Math.round(s.closeMs * k);
  return t;
}

export interface Pick {
  scenario: Scenario | null;
  used: string[];
  seed: number;
}

/**
 * Picks the next scenario. With a level: that level's difficulties, fakes only from
 * level 3, falling back to the nearest level with anything left. Without a level
 * (Practice): anything. Fakes never appear below level 3, even as a fallback.
 * No repeats until the eligible pool is used up.
 */
export function pickScenario(pool: Scenario[], level: Level | null, used: string[], seed: number): Pick {
  const fakesOk = level === null || LEVELS[level].fakes;
  const base = pool.filter(s => fakesOk || !s.fake);

  const candidatesFor = (lv: Level | null) =>
    lv === null ? base : base.filter(s => LEVELS[lv].difficulties.includes(s.difficulty));

  let eligible: Scenario[] = [];
  if (level === null) {
    eligible = base;
  } else {
    // Try the level, then the nearest levels outward (lower first on ties).
    for (let d = 0; d <= 4 && eligible.length === 0; d++) {
      for (const lv of [level - d, level + d]) {
        if (lv >= 1 && lv <= 5 && eligible.length === 0) eligible = candidatesFor(lv as Level);
      }
    }
  }
  if (eligible.length === 0) return { scenario: null, used, seed };

  let fresh = eligible.filter(s => !used.includes(s.id));
  let nextUsed = used;
  if (fresh.length === 0) {
    // Pool used up: allow repeats again, but drop this set from the used list.
    const ids = new Set(eligible.map(s => s.id));
    nextUsed = used.filter(id => !ids.has(id));
    fresh = eligible;
  }
  // Never the same scenario twice in a row when there is a choice.
  const last = used[used.length - 1];
  if (fresh.length > 1) fresh = fresh.filter(s => s.id !== last);
  const [r, nextSeed] = nextRandom(seed);
  const scenario = fresh[Math.floor(r * fresh.length)];
  return { scenario, used: [...nextUsed, scenario.id], seed: nextSeed };
}
