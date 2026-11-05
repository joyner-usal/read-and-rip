import { describe, expect, it } from 'vitest';
import { createGame, reduce, clockLeftMs, readElapsedMs, lastElapsedMs, summarize, DEFAULTS, type GameConfig, type GameEvent, type GameState } from '../machine';
import { sc } from './fixtures';

const cfg = (over: Partial<GameConfig> = {}): GameConfig => ({ game: 'boys', mode: 'shooter', practice: false, longerWindows: false, ...DEFAULTS, ...over });
// Window 2000 ms at level 1; set up 600 ms; feedback 1200 ms.
const pool = [sc({ id: 'a' }), sc({ id: 'b' }), sc({ id: 'c' }), sc({ id: 'other', game: 'girls' })];
const play = (s: GameState, ...events: GameEvent[]) => events.reduce(reduce, s);

describe('rep flow', () => {
  it('starts in set up, opens the read window after 600 ms', () => {
    let g = createGame(cfg(), pool, 1, 0);
    expect(g.phase).toBe('setup');
    expect(g.pool.map(p => p.id)).not.toContain('other');
    g = reduce(g, { type: 'tick', now: 599 });
    expect(g.phase).toBe('setup');
    g = reduce(g, { type: 'tick', now: 600 });
    expect(g.phase).toBe('reading');
  });

  it('ignores taps during set up', () => {
    const g = play(createGame(cfg(), pool, 1, 0), { type: 'tap', zone: 'low-right', now: 300 });
    expect(g.phase).toBe('setup');
    expect(g.reps).toHaveLength(0);
  });

  it('scores a tap with time measured from the start of the window', () => {
    const g = play(createGame(cfg(), pool, 1, 0), { type: 'tap', zone: 'low-right', now: 600 + 500 });
    expect(g.phase).toBe('feedback');
    expect(g.reps[0]).toMatchObject({ outcome: 'best', points: 4, responseMs: 500, speedBonus: true, level: 1 });
    expect(g.score).toBe(4);
  });

  it('keeps a pause-aware clock on the last rep through feedback', () => {
    let g = play(createGame(cfg(), pool, 1, 0), { type: 'tap', zone: 'low-right', now: 1100 });
    expect(lastElapsedMs(g, 1300)).toBe(700);
    g = play(g, { type: 'pause', now: 1300 });
    expect(lastElapsedMs(g, 9000)).toBe(700);
    g = play(g, { type: 'resume', now: 9000 });
    expect(lastElapsedMs(g, 9100)).toBe(800);
  });

  it('times out when the window closes with no tap', () => {
    const g = play(createGame(cfg(), pool, 1, 0), { type: 'tick', now: 600 + 2000 });
    expect(g.reps[0].outcome).toBe('timeout');
  });

  it('one tap per rep: a second tap does nothing', () => {
    const g = play(createGame(cfg(), pool, 1, 0), { type: 'tap', zone: 'low-right', now: 1000 }, { type: 'tap', zone: 'top-left', now: 1050 });
    expect(g.reps).toHaveLength(1);
  });

  it('feedback ends on its own after 1.2 s, or on Continue', () => {
    let g = play(createGame(cfg(), pool, 1, 0), { type: 'tap', zone: 'low-right', now: 1000 });
    expect(reduce(g, { type: 'tick', now: 2199 }).phase).toBe('feedback');
    expect(reduce(g, { type: 'tick', now: 2200 }).phase).toBe('setup');
    g = reduce(g, { type: 'continue', now: 1100 });
    expect(g.phase).toBe('setup');
    expect(g.rep!.readStartsAt).toBe(1700);
  });
});

describe('round clock', () => {
  it('runs in set up and read, stops in feedback', () => {
    let g = play(createGame(cfg(), pool, 1, 0), { type: 'tap', zone: 'low-right', now: 1000 });
    expect(clockLeftMs(g, 1000)).toBe(29_000);
    expect(clockLeftMs(g, 2100)).toBe(29_000); // still feedback
    g = reduce(g, { type: 'tick', now: 3200 }); // next rep set up started at 2200
    expect(clockLeftMs(g, 3200)).toBe(28_000);
  });

  it('a rep running past zero plays out and counts, then the round ends', () => {
    let g = createGame(cfg({ roundMs: 1000 }), pool, 1, 0);
    g = reduce(g, { type: 'tap', zone: 'mid-right', now: 1500 }); // clock hit 0 at 1000, mid-read
    expect(g.phase).toBe('feedback');
    expect(g.reps[0].outcome).toBe('good');
    g = reduce(g, { type: 'continue', now: 1600 });
    expect(g.phase).toBe('summary');
    expect(g.endReason).toBe('clock');
  });

  it('a long gap fires every transition in order', () => {
    const g = reduce(createGame(cfg({ roundMs: 3000 }), pool, 1, 0), { type: 'tick', now: 60_000 });
    expect(g.phase).toBe('summary');
    expect(g.reps.every(r => r.outcome === 'timeout')).toBe(true);
    expect(g.reps).toHaveLength(2); // 2600 ms per timed out rep against a 3000 ms clock
  });
});

describe('pause', () => {
  it('freezes the rep and the clock', () => {
    let g = createGame(cfg(), pool, 1, 0);
    g = play(g, { type: 'tick', now: 700 }, { type: 'pause', now: 800 });
    expect(reduce(g, { type: 'tick', now: 99_999 }).phase).toBe('reading');
    expect(reduce(g, { type: 'tap', zone: 'low-right', now: 5000 }).reps).toHaveLength(0);
    expect(clockLeftMs(g, 50_000)).toBe(29_200);
    g = reduce(g, { type: 'resume', now: 10_800 });
    expect(readElapsedMs(g, 10_800)).toBe(200);
    g = reduce(g, { type: 'tap', zone: 'low-right', now: 10_900 });
    expect(g.reps[0].responseMs).toBe(300);
    expect(clockLeftMs(g, 10_900)).toBe(29_100);
  });
});

describe('ramp in a round', () => {
  it('moves up after 3 scoring reps and uses the shorter window', () => {
    let g = createGame(cfg(), [sc({ id: 'a', difficulty: 1 }), sc({ id: 'b', difficulty: 1 }), sc({ id: 'c', difficulty: 2 })], 1, 0);
    for (let i = 0; i < 3; i++) {
      const start = g.rep!.readStartsAt;
      g = play(g, { type: 'tap', zone: 'low-right', now: start + 100 }, { type: 'continue', now: start + 200 });
    }
    expect(g.ramp.level).toBe(2);
    expect(g.rep!.level).toBe(2);
    expect(g.rep!.timing.windowMs).toBe(1800);
  });

  it('longer read windows multiply on top', () => {
    expect(createGame(cfg({ longerWindows: true }), pool, 1, 0).rep!.timing.windowMs).toBe(3000);
  });
});

describe('fakes in the loop', () => {
  it('goalie early tap costs 1, but the round never drops below 0', () => {
    const fake = sc({ id: 'gf', mode: 'goalie', cueType: 'stick-fake', fake: true, releaseMs: 1000, difficulty: 3 });
    const g = play(createGame(cfg({ mode: 'goalie', practice: true }), [fake], 1, 0), { type: 'tap', zone: 'low-right', now: 600 + 2 * 900 });
    expect(g.reps[0]).toMatchObject({ outcome: 'early', points: -1 });
    expect(g.score).toBe(0);
  });
  it('shooter bait is 0 and named', () => {
    const fake = sc({ id: 'sf', fake: true, baitZone: 'top-left', closeMs: 800, difficulty: 3 });
    const g = play(createGame(cfg({ practice: true }), [fake], 1, 0), { type: 'tap', zone: 'top-left', now: 700 });
    expect(g.reps[0]).toMatchObject({ outcome: 'bait', points: 0 });
  });
});

describe('practice mode (D17)', () => {
  it('has no clock, doubles windows, skips the ramp, and waits for Continue', () => {
    let g = createGame(cfg({ practice: true }), pool, 1, 0);
    expect(clockLeftMs(g, 1e9)).toBe(Infinity);
    expect(g.rep!.timing.windowMs).toBe(4000);
    expect(g.rep!.level).toBeNull();
    g = reduce(g, { type: 'tap', zone: 'low-right', now: 700 });
    expect(reduce(g, { type: 'tick', now: 1e7 }).phase).toBe('feedback');
    g = reduce(g, { type: 'continue', now: 800 });
    expect(g.phase).toBe('setup');
    expect(g.ramp.level).toBe(1);
  });
  it('ends with End', () => {
    const g = reduce(createGame(cfg({ practice: true }), pool, 1, 0), { type: 'end', now: 5000 });
    expect(g.phase).toBe('summary');
    expect(g.endReason).toBe('quit');
  });
});

describe('summary', () => {
  it('counts results and lists reps to review once each', () => {
    let g = createGame(cfg({ practice: true }), [sc({ id: 'only', mirror: false })], 1, 0);
    const tapAndGo = (zone: 'low-right' | 'top-left') => {
      const start = g.rep!.readStartsAt;
      g = play(g, { type: 'tap', zone, now: start + 3000 }, { type: 'continue', now: start + 3100 });
    };
    tapAndGo('low-right');
    tapAndGo('top-left');
    tapAndGo('top-left');
    g = reduce(g, { type: 'end', now: 1e6 });
    expect(summarize(g)).toMatchObject({ score: 3, reps: 3, best: 1, good: 0, toReview: ['only'] });
  });
  it('an empty pool ends right away', () => {
    expect(createGame(cfg(), [], 1, 0)).toMatchObject({ phase: 'summary', endReason: 'empty' });
  });
});
