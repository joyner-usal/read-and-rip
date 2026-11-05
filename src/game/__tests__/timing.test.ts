import { describe, expect, it } from 'vitest';
import {
  BASE_FLIGHT_MS, CARD_DELAY_MS, FLIGHT_MS, LOAD_MS, REDUCED_FRAME_MS, RELEASE_HOLD_MS, flightProgress, releasePoint, shotSchedule
} from '../timing';

describe('shot sequence', () => {
  it('runs shot, contact, hold, then card, in that order (shooter mode)', () => {
    const s = shotSchedule('shooter', false, { windowMs: 2000 }, 700, false);
    expect(s.loadAt).toBe(700); // your tap starts the load
    expect(s.releaseAt).toBe(700 + LOAD_MS);
    expect(s.followAt).toBe(s.releaseAt + RELEASE_HOLD_MS);
    expect(s.contactAt).toBe(s.releaseAt + FLIGHT_MS);
    expect(s.revealAt).toBe(s.contactAt + CARD_DELAY_MS);
    expect(s.loadAt < s.releaseAt && s.releaseAt < s.followAt && s.followAt < s.contactAt && s.contactAt < s.revealAt).toBe(true);
  });
  it('the card never comes before the ball lands', () => {
    for (const r of [0, 300, 1999]) {
      const s = shotSchedule('shooter', false, { windowMs: 2000 }, r, false);
      expect(s.revealAt - s.contactAt).toBe(CARD_DELAY_MS);
    }
  });
  it('a timeout still shoots, at the buzzer', () => expect(shotSchedule('shooter', false, { windowMs: 2000 }, 2000, false).releaseAt).toBe(2120));
  it('goalie mode releases at the cue release point', () => {
    const s = shotSchedule('goalie', false, { windowMs: 1800 }, null, false);
    expect(s.releaseAt).toBe(1260);
    expect(s.loadAt).toBe(1140);
  });
  it('goalie mode: an early tap on a real shot makes the shooter let it go', () => {
    expect(shotSchedule('goalie', false, { windowMs: 1800 }, 500, false).releaseAt).toBe(620);
    expect(shotSchedule('goalie', false, { windowMs: 1800 }, 1200, false).releaseAt).toBe(1260);
  });
  it('goalie mode: a tap on a fake does not pull the release forward', () => {
    expect(shotSchedule('goalie', true, { windowMs: 1800, releaseMs: 1100 }, 500, false).releaseAt).toBe(1100);
  });
  it('reduced motion: release, mid-flight, contact, then the card, 250 ms apart', () => {
    const s = shotSchedule('shooter', false, { windowMs: 2000 }, 700, true);
    expect(s.contactAt - s.releaseAt).toBe(2 * REDUCED_FRAME_MS);
    expect(s.revealAt - s.contactAt).toBe(REDUCED_FRAME_MS);
  });
  it('release point is the fake release or 70% in', () => {
    expect(releasePoint({ windowMs: 2000 })).toBe(1400);
    expect(releasePoint({ windowMs: 2000, releaseMs: 900 })).toBe(900);
  });
});

describe('flight progress', () => {
  it('takes about 600 ms in all, slow motion included', () => {
    expect(flightProgress(0)).toBe(0);
    expect(flightProgress(FLIGHT_MS)).toBeCloseTo(1);
    expect(flightProgress(FLIGHT_MS - 1)).toBeLessThan(1);
  });
  it('starts slow out of the stick and is fast through the middle', () => {
    const early = flightProgress(60) - flightProgress(0);
    const mid = flightProgress(330) - flightProgress(270);
    expect(mid).toBeGreaterThan(early * 2);
  });
  it('plays the last 20% at half the average speed before it', () => {
    const fastMs = BASE_FLIGHT_MS * 0.8;
    expect(flightProgress(fastMs)).toBeCloseTo(0.8);
    const slowSpeed = 0.2 / (FLIGHT_MS - fastMs);
    const avgFastSpeed = 0.8 / fastMs;
    expect(slowSpeed / avgFastSpeed).toBeCloseTo(0.5);
  });
  it('never runs backward', () => {
    let prev = 0;
    for (let t = 0; t <= 700; t += 5) {
      const u = flightProgress(t);
      expect(u).toBeGreaterThanOrEqual(prev);
      prev = u;
    }
  });
});
