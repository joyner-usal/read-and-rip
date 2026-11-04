// SPEC.md section 5: every row of the level table and every ramp rule.
import { describe, expect, it } from 'vitest';
import { LEVELS, pickScenario, scaleTiming, startRamp, updateRamp, type Level, type RampState } from '../ramp';
import type { Outcome } from '../scoring';
import { sc } from './fixtures';

const run = (outcomes: Outcome[], r: RampState = startRamp()) => outcomes.reduce(updateRamp, r);

describe('level table', () => {
  const rows: [Level, number[], number, boolean][] = [
    [1, [1], 1.0, false], [2, [1, 2], 0.9, false], [3, [2, 3], 0.8, true], [4, [3, 4], 0.7, true], [5, [4, 5], 0.6, true]
  ];
  it.each(rows)('level %i draws %j at x%f, fakes %s', (lv, diffs, scale, fakes) => {
    expect(LEVELS[lv]).toEqual({ difficulties: diffs, scale, fakes });
  });
});

describe('moving between levels', () => {
  it('starts at level 1', () => expect(startRamp().level).toBe(1));
  it('goes up after 3 scoring reps in a row', () => {
    expect(run(['best', 'good']).level).toBe(1);
    expect(run(['best', 'good', 'best']).level).toBe(2);
  });
  it('a miss breaks the up streak', () => expect(run(['best', 'best', 'miss', 'best']).level).toBe(1));
  it('goes down after 2 non-scoring reps in a row', () => {
    const at3: RampState = { level: 3, scoringStreak: 0, missStreak: 0 };
    expect(run(['miss'], at3).level).toBe(3);
    expect(run(['miss', 'timeout'], at3).level).toBe(2);
    expect(run(['early', 'bait'], at3).level).toBe(2);
  });
  it('a score breaks the down streak', () => expect(run(['miss', 'good', 'miss'], { level: 3, scoringStreak: 0, missStreak: 0 }).level).toBe(3));
  it('stays within 1 to 5', () => {
    expect(run(['miss', 'miss', 'miss', 'miss']).level).toBe(1);
    expect(run(Array(30).fill('best')).level).toBe(5);
  });
});

describe('timing', () => {
  it('scales the read window by level', () => {
    expect(scaleTiming(sc({ readWindowMs: 2000 }), LEVELS[3].scale).windowMs).toBe(1600);
    expect(scaleTiming(sc({ readWindowMs: 2000 }), LEVELS[5].scale).windowMs).toBe(1200);
  });
  it('never drops below 400 ms', () => expect(scaleTiming(sc({ readWindowMs: 500 }), 0.6).windowMs).toBe(400));
  it('moves fake times with the window', () => {
    const t = scaleTiming(sc({ mode: 'goalie', fake: true, readWindowMs: 2000, releaseMs: 1500 }), 0.5);
    expect(t).toEqual({ windowMs: 1000, releaseMs: 750 });
    const b = scaleTiming(sc({ fake: true, readWindowMs: 2000, closeMs: 800, baitZone: 'top-left' }), 2);
    expect(b).toEqual({ windowMs: 4000, closeMs: 1600 });
  });
  it('keeps fake times inside the window at the 400 ms floor', () => {
    const t = scaleTiming(sc({ mode: 'goalie', fake: true, readWindowMs: 600, releaseMs: 500 }), 0.6);
    expect(t.windowMs).toBe(400);
    expect(t.releaseMs!).toBeLessThan(400);
  });
});

describe('picking scenarios', () => {
  const pool = [
    sc({ id: 'd1', difficulty: 1 }), sc({ id: 'd2', difficulty: 2 }), sc({ id: 'd3', difficulty: 3 }),
    sc({ id: 'd3-fake', difficulty: 3, fake: true, baitZone: 'top-left', closeMs: 900 }), sc({ id: 'd5', difficulty: 5 })
  ];
  const ids = (level: Level | null, n = 40) => {
    let used: string[] = [];
    let seed = 7;
    const out = new Set<string>();
    for (let i = 0; i < n; i++) {
      const p = pickScenario(pool, level, used, seed);
      out.add(p.scenario!.id);
      used = p.used;
      seed = p.seed;
    }
    return out;
  };
  it('level 1 draws difficulty 1 only', () => expect(ids(1)).toEqual(new Set(['d1'])));
  it('level 2 draws difficulty 1 to 2', () => expect(ids(2)).toEqual(new Set(['d1', 'd2'])));
  it('level 3 draws difficulty 2 to 3, fakes included', () => expect(ids(3)).toEqual(new Set(['d2', 'd3', 'd3-fake'])));
  it('level 4 draws difficulty 3 to 4', () => expect(ids(4)).toEqual(new Set(['d3', 'd3-fake'])));
  it('level 5 draws difficulty 4 to 5', () => expect(ids(5)).toEqual(new Set(['d5'])));
  it('no fakes below level 3, even as a fallback', () => {
    const fakesOnly = [sc({ id: 'f', difficulty: 2, fake: true, baitZone: 'top-left', closeMs: 900 }), sc({ id: 'n', difficulty: 5 })];
    expect(pickScenario(fakesOnly, 2, [], 1).scenario!.id).toBe('n');
  });
  it('falls back to the nearest level with scenarios', () => {
    const only5 = [sc({ id: 'x', difficulty: 5 })];
    expect(pickScenario(only5, 1, [], 1).scenario!.id).toBe('x');
  });
  it('practice (no level) draws everything, fakes included', () => expect(ids(null, 80)).toEqual(new Set(pool.map(p => p.id))));
  it('does not repeat until the eligible pool is used up', () => {
    let used: string[] = [];
    let seed = 3;
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      const p = pickScenario(pool, 3, used, seed);
      seen.push(p.scenario!.id);
      used = p.used;
      seed = p.seed;
    }
    expect(new Set(seen).size).toBe(3);
  });
  it('never repeats back to back when there is a choice', () => {
    let used: string[] = [];
    let seed = 11;
    let prev = '';
    for (let i = 0; i < 50; i++) {
      const p = pickScenario(pool, 2, used, seed);
      expect(p.scenario!.id).not.toBe(prev);
      prev = p.scenario!.id;
      used = p.used;
      seed = p.seed;
    }
  });
  it('returns null on an empty pool', () => expect(pickScenario([], 1, [], 1).scenario).toBeNull());
});
