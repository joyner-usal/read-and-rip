import { describe, expect, it } from 'vitest';
import { AFTER_MS, GROUND_GOAL, R_FAR, R_NEAR, TRAIL_POINTS, ballAt, shotTarget } from './ball';
import { MOUTH, zoneCenter } from './manifest';
import { CONTACT_FREEZE_MS, FLIGHT_MS, REDUCED_FRAME_MS } from '../game/timing';

const from = { x: 330, y: 620 };

describe('ball flight', () => {
  it('starts at the stick pocket at radius 10 and lands at radius 5', () => {
    const a = ballAt(from, 'top-left', 'goal', 0, true, false)!;
    expect(a).toMatchObject({ x: from.x, y: from.y, r: R_NEAR });
    const b = ballAt(from, 'top-left', 'goal', FLIGHT_MS - 1, true, false)!;
    expect(b.r).toBeCloseTo(R_FAR, 0);
  });
  it('arcs above the straight line', () => {
    const mid = ballAt(from, 'low-left', 'goal', FLIGHT_MS / 2, true, false)!;
    const to = zoneCenter('low-left');
    expect(mid.y).toBeLessThan((from.y + to.y) / 2);
  });
  it('leaves a 6-point trail, none in reduced motion', () => {
    expect(ballAt(from, 'mid-right', 'goal', 300, true, false)!.trail).toHaveLength(TRAIL_POINTS);
    expect(ballAt(from, 'mid-right', 'goal', 300, true, true)!.trail).toHaveLength(0);
  });
  it('casts a shadow on the turf below it that shrinks and fades as it rises', () => {
    const low = ballAt(from, 'low-right', 'goal', 20, true, false)!.shadow!;
    const high = ballAt(from, 'top-right', 'goal', 330, true, false)!;
    expect(high.shadow!.y).toBeGreaterThan(high.y); // on the ground, below the ball
    expect(high.shadow!.x).toBeCloseTo(high.x);
    expect(high.shadow!.alpha).toBeLessThan(low.alpha + 0.2);
    const apex = ballAt(from, 'top-left', 'goal', 330, true, false)!;
    const landed = ballAt(from, 'top-left', 'goal', FLIGHT_MS - 1, true, false)!;
    expect(apex.shadow!.rx / apex.r).toBeLessThanOrEqual(landed.shadow!.rx / landed.r + 0.4);
  });
  it('reduced motion: release, mid-flight and contact as still frames 250 ms apart', () => {
    expect(ballAt(from, 'mid-right', 'goal', 10, true, true)).toMatchObject({ x: from.x, y: from.y });
    expect(ballAt(from, 'mid-right', 'goal', REDUCED_FRAME_MS + 10, true, true)).toEqual(ballAt(from, 'mid-right', 'goal', 2 * REDUCED_FRAME_MS - 10, true, true));
    expect(ballAt(from, 'mid-right', 'goal', 2 * REDUCED_FRAME_MS + 10, true, true)!.effect).not.toBeNull();
  });
  it('never arrives while the rep is unresolved', () => {
    expect(ballAt(from, 'low-right', 'goal', 5000, false, false)!.effect).toBeNull();
  });
});

describe('contact', () => {
  it('freezes for 70 ms at contact, then the effect plays', () => {
    const f1 = ballAt(from, 'low-right', 'goal', FLIGHT_MS + 10, true, false)!;
    const f2 = ballAt(from, 'low-right', 'goal', FLIGHT_MS + CONTACT_FREEZE_MS - 1, true, false)!;
    expect(f1.effect).toMatchObject({ kind: 'goal', frozen: true, age: 0 });
    expect([f1.x, f1.y]).toEqual([f2.x, f2.y]);
    expect(ballAt(from, 'low-right', 'goal', FLIGHT_MS + CONTACT_FREEZE_MS + 100, true, false)!.effect).toMatchObject({ frozen: false, age: 100 });
  });
  it('a save deflects up and away with a spin trail', () => {
    const b = ballAt(from, 'top-left', 'save', FLIGHT_MS + CONTACT_FREEZE_MS + 200, true, false)!;
    expect(b.y).toBeLessThan(zoneCenter('top-left').y);
    expect(b.x).toBeLessThan(zoneCenter('top-left').x);
    expect(b.spin).toBe(true);
    expect(b.trail).toHaveLength(TRAIL_POINTS);
  });
  it('a wide shot passes the pipe, bounces once on the grass, then rolls toward the fence', () => {
    const t = shotTarget('mid-left', 'wide');
    expect(t.x).toBeLessThan(MOUTH.x);
    const bounce = ballAt(from, 'mid-left', 'wide', FLIGHT_MS + CONTACT_FREEZE_MS + 199, true, false)!;
    expect(Math.abs(bounce.y - (GROUND_GOAL + 6))).toBeLessThan(2);
    const rolling = ballAt(from, 'mid-left', 'wide', FLIGHT_MS + CONTACT_FREEZE_MS + 700, true, false)!;
    expect(rolling.y).toBeLessThan(bounce.y); // up the field, toward the fence
    expect(rolling.x).toBeLessThan(bounce.x);
  });
  it('pings the pipe when it passes within 6 px', () => {
    expect(MOUTH.x - shotTarget('mid-left', 'wide', true).x).toBeLessThanOrEqual(6);
    expect(ballAt(from, 'mid-left', 'wide', FLIGHT_MS + 1, true, false, true)!.effect!.ping).toBe(true);
    expect(ballAt(from, 'top-left', 'wide', FLIGHT_MS + 1, true, false, false)!.effect!.ping).toBe(false);
  });
  it('is gone after the effect', () => expect(ballAt(from, 'mid-left', 'save', FLIGHT_MS + AFTER_MS + 1, true, false)).toBeNull());
});
