import { describe, expect, it } from 'vitest';
import { ballAt, goalieOpening, goalieTimeline, sample, shooterTimeline, shooterCarry } from './cues';
import { sc } from '../game/__tests__/fixtures';

const timing = { windowMs: 2000, closeMs: 900 };
const bait = sc({ fake: true, baitZone: 'mid-left', closeMs: 900, bestZone: 'low-right', goodZones: [] });

describe('goalie rig', () => {
  it('moves away from the open zone', () => {
    expect(goalieOpening('low-right').x).toBeLessThan(0);
    expect(goalieOpening('top-left').x).toBeGreaterThan(0);
    expect(goalieOpening('top-left').crouch).toBeGreaterThan(goalieOpening('low-left').crouch);
  });
  it('shows the bait open, then closes it at closeMs (D15)', () => {
    const keys = goalieTimeline(bait, timing);
    const before = sample(keys, 880, false);
    const after = sample(keys, 1900, false);
    expect(before.x).toBeGreaterThan(0); // body right, so the left bait is open
    expect(after.x).toBeLessThan(0); // body slides left over the bait; low right opens
  });
  it('stays neutral in goalie mode (that is you)', () => {
    expect(goalieTimeline(sc({ mode: 'goalie', cueType: 'hands-low' }), timing)).toHaveLength(1);
  });
});

describe('reduced motion', () => {
  it('snaps to key poses with no in-between frames', () => {
    const keys = goalieTimeline(sc(), { windowMs: 2000 });
    const target = goalieOpening('low-right');
    const mid = sample(keys, 400, true); // halfway through the blend
    expect(mid).toEqual(target);
    expect(sample(keys, 400, false)).not.toEqual(target);
    expect(sample(keys, 100, true)).toEqual(keys[0].pose);
  });
  it('shows the ball in two still frames', () => {
    const g = sc({ mode: 'goalie', cueType: 'hands-high', bestZone: 'top-left' });
    const t = { windowMs: 2000 };
    expect(ballAt(g, t, 1300, true)).toBeNull();
    expect(ballAt(g, t, 1450, true)!.progress).toBe(0.5);
    expect(ballAt(g, t, 2000, true)!.progress).toBe(1);
  });
});

describe('shooter rig', () => {
  it('stays in carry in shooter mode', () => expect(shooterTimeline(sc(), timing)).toEqual([{ at: 0, dur: 0, pose: shooterCarry(sc()) }]));
  it('a goalie fake pumps before the real release', () => {
    const g = sc({ mode: 'goalie', cueType: 'stick-fake', fake: true, releaseMs: 1100 });
    const keys = shooterTimeline(g, { windowMs: 1800, releaseMs: 1100 });
    expect(keys.map(k => k.at).at(-1)).toBe(1100);
    expect(keys.length).toBe(4);
  });
  it('no ball before release', () => {
    const g = sc({ mode: 'goalie', cueType: 'hands-low', bestZone: 'low-left' });
    expect(ballAt(g, { windowMs: 2000 }, 1000, false)).toBeNull();
    expect(ballAt(g, { windowMs: 2000 }, 2000, false)!.progress).toBe(1);
  });
});
