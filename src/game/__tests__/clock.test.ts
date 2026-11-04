import { describe, expect, it } from 'vitest';
import { clockExpired, newClock, remainingMs, runClock, stopClock } from '../clock';

describe('round clock', () => {
  it('counts down only while running', () => {
    let c = runClock(newClock(30_000), 0);
    expect(remainingMs(c, 10_000)).toBe(20_000);
    c = stopClock(c, 10_000);
    expect(remainingMs(c, 50_000)).toBe(20_000);
    c = runClock(c, 50_000);
    expect(remainingMs(c, 55_000)).toBe(15_000);
  });
  it('expires at zero and never goes negative', () => {
    const c = runClock(newClock(1000), 0);
    expect(clockExpired(c, 999)).toBe(false);
    expect(clockExpired(c, 1000)).toBe(true);
    expect(remainingMs(c, 5000)).toBe(0);
  });
  it('no limit means it never expires (Practice)', () => expect(clockExpired(runClock(newClock(null), 0), 1e9)).toBe(false));
  it('running or stopping twice is harmless', () => {
    const c = runClock(runClock(newClock(1000), 0), 500);
    expect(c.runningSince).toBe(0);
    expect(stopClock(stopClock(c, 100), 900).usedMs).toBe(100);
  });
});
