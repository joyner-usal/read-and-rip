// Round clock (SPEC.md section 3). Pure: callers pass the time in.
// It runs only while a rep is in set up or read; feedback and pause stop it.

export interface RoundClock {
  /** Null means no clock (Practice). */
  limitMs: number | null;
  usedMs: number;
  runningSince: number | null;
}

export const newClock = (limitMs: number | null): RoundClock => ({ limitMs, usedMs: 0, runningSince: null });

export function runClock(c: RoundClock, now: number): RoundClock {
  return c.runningSince === null ? { ...c, runningSince: now } : c;
}

export function stopClock(c: RoundClock, now: number): RoundClock {
  if (c.runningSince === null) return c;
  return { ...c, usedMs: c.usedMs + Math.max(0, now - c.runningSince), runningSince: null };
}

export function remainingMs(c: RoundClock, now: number): number {
  if (c.limitMs === null) return Infinity;
  const used = c.usedMs + (c.runningSince === null ? 0 : Math.max(0, now - c.runningSince));
  return Math.max(0, c.limitMs - used);
}

export const clockExpired = (c: RoundClock, now: number) => remainingMs(c, now) <= 0;
