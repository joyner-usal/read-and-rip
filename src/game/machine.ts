// The game loop as a pure state machine (SPEC.md section 3). No React, no DOM, no timers:
// the UI sends events with the current time and draws whatever state comes back.
//
// Times inside the state are "game time": real time minus every paused stretch, so a
// pause freezes the rep and the clock exactly where they were.
import type { Game, Mode, Scenario, Zone } from '../scenarios/types';
import { newClock, runClock, stopClock, clockExpired, remainingMs, type RoundClock } from './clock';
import {
  LEVELS, LONGER_WINDOWS_SCALE, PRACTICE_SCALE, pickScenario, scaleTiming, startRamp, updateRamp,
  type Level, type RampState, type Timing
} from './ramp';
import { addToRound, scoreRep, type Outcome } from './scoring';

export interface GameConfig {
  game: Game;
  mode: Mode;
  practice: boolean;
  longerWindows: boolean;
  roundMs: number;
  setupMs: number;
  feedbackMs: number;
}

export const DEFAULTS = { roundMs: 30_000, setupMs: 600, feedbackMs: 1_200 } as const;

export type Phase = 'setup' | 'reading' | 'feedback' | 'summary';
export type EndReason = 'clock' | 'quit' | 'empty';

export interface LiveRep {
  scenario: Scenario;
  timing: Timing;
  level: Level | null;
  /** Game time when the read window opens (set up ends). */
  readStartsAt: number;
}

export interface RepRecord {
  scenarioId: string;
  tappedZone: Zone | null;
  outcome: Outcome;
  responseMs: number | null;
  points: number;
  speedBonus: boolean;
  level: Level | null;
}

export interface GameState {
  config: GameConfig;
  pool: Scenario[];
  phase: Phase;
  paused: boolean;
  pausedAt: number | null;
  pausedTotal: number;
  clock: RoundClock;
  ramp: RampState;
  score: number;
  reps: RepRecord[];
  used: string[];
  seed: number;
  rep: LiveRep | null;
  /** The rep just resolved, shown in feedback. */
  last: { record: RepRecord; scenario: Scenario; timing: Timing } | null;
  /** Game time when feedback ends on its own. Null waits for Continue (Practice). */
  feedbackEndsAt: number | null;
  startedAt: number;
  endedAt: number | null;
  endReason: EndReason | null;
}

export type GameEvent =
  | { type: 'tick'; now: number }
  | { type: 'tap'; zone: Zone; now: number }
  | { type: 'continue'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'end'; now: number };

const gameTime = (s: GameState, now: number) => now - s.pausedTotal;

function multiplier(config: GameConfig, level: Level | null): number {
  const base = config.practice || level === null ? PRACTICE_SCALE : LEVELS[level].scale;
  return base * (config.longerWindows ? LONGER_WINDOWS_SCALE : 1);
}

function startRep(s: GameState, at: number): GameState {
  const level = s.config.practice ? null : s.ramp.level;
  const pick = pickScenario(s.pool, level, s.used, s.seed);
  if (!pick.scenario) return finish({ ...s, seed: pick.seed }, at, 'empty');
  return {
    ...s,
    phase: 'setup',
    used: pick.used,
    seed: pick.seed,
    rep: {
      scenario: pick.scenario,
      timing: scaleTiming(pick.scenario, multiplier(s.config, level)),
      level,
      readStartsAt: at + s.config.setupMs
    },
    feedbackEndsAt: null,
    clock: runClock(s.clock, at)
  };
}

function finish(s: GameState, at: number, reason: EndReason): GameState {
  return { ...s, phase: 'summary', rep: null, paused: false, pausedAt: null, clock: stopClock(s.clock, at), endedAt: at + s.pausedTotal, endReason: reason };
}

function resolve(s: GameState, at: number, tap: { zone: Zone; atMs: number } | null): GameState {
  const rep = s.rep!;
  const sc = rep.scenario;
  const result = scoreRep(
    { mode: sc.mode, fake: sc.fake, bestZone: sc.bestZone, goodZones: sc.goodZones, windowMs: rep.timing.windowMs, releaseMs: rep.timing.releaseMs, baitZone: sc.baitZone },
    tap
  );
  const record: RepRecord = {
    scenarioId: sc.id,
    tappedZone: tap?.zone ?? null,
    outcome: result.outcome,
    responseMs: tap ? Math.round(tap.atMs) : null,
    points: result.points,
    speedBonus: result.speedBonus,
    level: rep.level
  };
  return {
    ...s,
    phase: 'feedback',
    score: addToRound(s.score, result.points),
    reps: [...s.reps, record],
    ramp: s.config.practice ? s.ramp : updateRamp(s.ramp, result.outcome),
    last: { record, scenario: sc, timing: rep.timing },
    rep: null,
    clock: stopClock(s.clock, at),
    feedbackEndsAt: s.config.practice ? null : at + s.config.feedbackMs
  };
}

function next(s: GameState, at: number): GameState {
  if (!s.config.practice && clockExpired(s.clock, at)) return finish(s, at, 'clock');
  return startRep(s, at);
}

/** Moves time forward, firing every transition that is due, in order. */
function advance(s: GameState, t: number): GameState {
  for (let guard = 0; guard < 10; guard++) {
    if (s.phase === 'setup' && s.rep && t >= s.rep.readStartsAt) {
      s = { ...s, phase: 'reading' };
      continue;
    }
    if (s.phase === 'reading' && s.rep && t >= s.rep.readStartsAt + s.rep.timing.windowMs) {
      s = resolve(s, s.rep.readStartsAt + s.rep.timing.windowMs, null);
      continue;
    }
    if (s.phase === 'feedback' && s.feedbackEndsAt !== null && t >= s.feedbackEndsAt) {
      s = next(s, s.feedbackEndsAt);
      continue;
    }
    break;
  }
  return s;
}

export function createGame(config: GameConfig, pool: Scenario[], seed: number, now: number): GameState {
  const base: GameState = {
    config,
    pool: pool.filter(p => p.game === config.game && p.mode === config.mode),
    phase: 'setup',
    paused: false,
    pausedAt: null,
    pausedTotal: 0,
    clock: newClock(config.practice ? null : config.roundMs),
    ramp: startRamp(),
    score: 0,
    reps: [],
    used: [],
    seed,
    rep: null,
    last: null,
    feedbackEndsAt: null,
    startedAt: now,
    endedAt: null,
    endReason: null
  };
  return startRep(base, now);
}

export function reduce(s: GameState, e: GameEvent): GameState {
  if (s.phase === 'summary') return s;

  if (e.type === 'pause') return s.paused ? s : { ...s, paused: true, pausedAt: e.now };
  if (e.type === 'resume') {
    if (!s.paused || s.pausedAt === null) return s;
    return { ...s, paused: false, pausedAt: null, pausedTotal: s.pausedTotal + (e.now - s.pausedAt) };
  }
  if (e.type === 'end') {
    const at = s.paused && s.pausedAt !== null ? gameTime(s, s.pausedAt) : gameTime(s, e.now);
    return finish(s, at, 'quit');
  }
  if (s.paused) return s;

  const t = gameTime(s, e.now);
  s = advance(s, t);

  switch (e.type) {
    case 'tick':
      return s;
    case 'tap':
      if (s.phase !== 'reading' || !s.rep) return s;
      return resolve(s, t, { zone: e.zone, atMs: Math.max(0, t - s.rep.readStartsAt) });
    case 'continue':
      if (s.phase !== 'feedback') return s;
      return advance(next(s, t), t);
  }
}

// ---- Read-only helpers for the UI ----

export function clockLeftMs(s: GameState, now: number): number {
  const t = s.paused && s.pausedAt !== null ? gameTime(s, s.pausedAt) : gameTime(s, now);
  return remainingMs(s.clock, t);
}

/** Ms into the current read window (negative during set up), or null. */
export function readElapsedMs(s: GameState, now: number): number | null {
  if (!s.rep) return null;
  const t = s.paused && s.pausedAt !== null ? gameTime(s, s.pausedAt) : gameTime(s, now);
  return t - s.rep.readStartsAt;
}

export interface Summary {
  score: number;
  reps: number;
  best: number;
  good: number;
  speedBonuses: number;
  /** Scenario ids of reps that didn't score, in order, without repeats. */
  toReview: string[];
  topLevel: Level | null;
}

export function summarize(s: GameState): Summary {
  const toReview: string[] = [];
  for (const r of s.reps) {
    if (r.outcome !== 'best' && r.outcome !== 'good' && !toReview.includes(r.scenarioId)) toReview.push(r.scenarioId);
  }
  const levels = s.reps.map(r => r.level).filter((l): l is Level => l !== null);
  return {
    score: s.score,
    reps: s.reps.length,
    best: s.reps.filter(r => r.outcome === 'best').length,
    good: s.reps.filter(r => r.outcome === 'good').length,
    speedBonuses: s.reps.filter(r => r.speedBonus).length,
    toReview,
    topLevel: levels.length ? (Math.max(...levels) as Level) : null
  };
}
