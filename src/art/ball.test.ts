import { describe, expect, it } from 'vitest';
import { AFTER_MS, ballAt, FLIGHT_MS, shotTarget } from './ball';
import { MOUTH, zoneCenter } from './manifest';

const from = { x: 330, y: 620 };

describe('ball flight', () => {
  it('starts at the stick pocket and shrinks with distance', () => {
    const a = ballAt(from, 'top-left', 'goal', 0, true, false)!;
    const b = ballAt(from, 'top-left', 'goal', FLIGHT_MS * 0.8, true, false)!;
    expect(a).toMatchObject({ x: from.x, y: from.y });
    expect(b.r).toBeLessThan(a.r);
  });
  it('arcs above the straight line', () => {
    const mid = ballAt(from, 'low-left', 'goal', FLIGHT_MS / 2, true, false)!;
    const to = zoneCenter('low-left');
    expect(mid.y).toBeLessThan((from.y + to.y) / 2);
  });
  it('leaves a short trail, but not in reduced motion', () => {
    expect(ballAt(from, 'mid-right', 'goal', 150, true, false)!.trail).toHaveLength(4);
    expect(ballAt(from, 'mid-right', 'goal', 150, true, true)!.trail).toHaveLength(0);
  });
  it('reduced motion shows still frames: mid-flight, then at the goal', () => {
    expect(ballAt(from, 'mid-right', 'goal', 30, true, true)).toEqual(ballAt(from, 'mid-right', 'goal', 250, true, true));
  });
  it('never arrives while the rep is unresolved', () => {
    const b = ballAt(from, 'low-right', 'goal', 5000, false, false)!;
    expect(b.effect).toBeNull();
  });
  it('a goal ripples the net at the zone', () => {
    const b = ballAt(from, 'low-right', 'goal', FLIGHT_MS + 100, true, false)!;
    expect(b.effect).toMatchObject({ kind: 'goal', age: 100, at: zoneCenter('low-right') });
  });
  it('a save deflects up and away from the stick head', () => {
    const b = ballAt(from, 'top-left', 'save', FLIGHT_MS + 200, true, false)!;
    expect(b.y).toBeLessThan(zoneCenter('top-left').y);
    expect(b.x).toBeLessThan(zoneCenter('top-left').x);
  });
  it('a wide shot ends outside the pipes', () => {
    expect(shotTarget('mid-left', 'wide').x).toBeLessThan(MOUTH.x);
    expect(shotTarget('mid-right', 'wide').x).toBeGreaterThan(MOUTH.x + MOUTH.w);
    expect(shotTarget('top-center', 'wide').y).toBeLessThan(MOUTH.y);
  });
  it('is gone after the effect', () => expect(ballAt(from, 'mid-left', 'save', FLIGHT_MS + AFTER_MS + 1, true, false)).toBeNull());
});
