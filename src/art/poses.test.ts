import { describe, expect, it } from 'vitest';
import { goalieCover, goalieSave, shotPlan, type RepView } from './poses';
import { MOUTH, SPRITES, fitFrame, placeSprite, toFrame, zoneCenter } from './manifest';
import { sc } from '../game/__tests__/fixtures';

const view = (over: Partial<RepView> = {}): RepView => ({
  mode: 'shooter', phase: 'reading', scenario: sc(), timing: { windowMs: 2000 }, repMs: 800, resolveMs: null, outcome: null, tapped: null, ...over
});

describe('layout', () => {
  it('the grid maps exactly onto the goal mouth', () => {
    expect(MOUTH).toEqual({ x: 112.5, y: 357.6, w: 165, h: 164.4 });
    expect(zoneCenter('top-left').x).toBeCloseTo(112.5 + 27.5);
    expect(zoneCenter('low-right').y).toBeCloseTo(357.6 + 164.4 * (5 / 6));
  });
  it('the ready goalie is about 174 tall with feet at y 535', () => {
    const r = placeSprite('goalie_gray_ready_high_screenleft', 195, 535);
    expect(r.h).toBeCloseTo(174, 0);
    expect(r.y + SPRITES.goalie_gray_ready_high_screenleft.anchor![1]).toBeCloseTo(535);
  });
  it('the cocked shooter is about 265 wide with its left edge at x 118', () => {
    const s = SPRITES.shooter_navy_cocked;
    expect(s.draw[0]).toBeCloseTo(265, 0);
  });
  it('fits the frame uniformly and letterboxes wide screens', () => {
    expect(fitFrame(390, 844)).toEqual({ scale: 1, x: 0, y: 0 });
    const f = fitFrame(1000, 844);
    expect(f.scale).toBe(1);
    expect(f.x).toBe(305);
    expect(toFrame(f, 305 + 195, 422)).toEqual({ x: 195, y: 422 });
    expect(fitFrame(820, 1180).scale).toBeCloseTo(1180 / 844); // tablet: contain, as before
  });
  it('short phone screens crop sky instead of shrinking the zones (D38)', () => {
    const f = fitFrame(390, 664); // phone browser with toolbars
    expect(f.scale).toBeCloseTo(664 / 684);
    expect(f.y + 844 * f.scale).toBeCloseTo(664); // bottom stays anchored
    expect((MOUTH.w * f.scale) / 3).toBeGreaterThan(48);
    expect(f.y + MOUTH.y * f.scale).toBeGreaterThan(130); // goal sits below the HUD and pill
    const g = fitFrame(390, 750); // a little short: crop only, no shrink
    expect(g.scale).toBe(1);
    expect(g.y).toBe(750 - 844);
  });
});

describe('goalie poses (never mirrored, picked by screen side)', () => {
  it('covers away from the open zone', () => {
    expect(goalieCover('low-right').sprite).toBe('goalie_gray_high_screenleft_lean');
    expect(goalieCover('low-left').sprite).toBe('goalie_gray_high_screenright');
    expect(goalieCover('top-left').sprite).toBe('goalie_gray_low_screenright');
    expect(goalieCover('top-right').sprite).toBe('goalie_gray_low_screenleft');
  });
  it('dives for a top screen-left save, navy when you are the goalie', () => {
    expect(goalieSave('top-left', 'navy')).toMatchObject({ sprite: 'goalie_navy_dive_screenleft', place: 'zone', zone: 'top-left' });
    expect(goalieSave('top-left', 'gray').sprite).toBe('goalie_gray_dive_screenleft');
  });
  it('lunges with the high screen-right pose for a top screen-right save', () => {
    const t = goalieSave('top-right', 'navy');
    expect(t.sprite).toBe('goalie_gray_high_screenright');
    expect(t.rot).toBeGreaterThan(0);
    expect(t.scale).toBeGreaterThan(1);
  });
  it('low saves use the low poses on the matching side', () => {
    expect(goalieSave('low-left', 'gray').sprite).toBe('goalie_gray_low_screenleft');
    expect(goalieSave('low-right', 'gray').sprite).toBe('goalie_gray_low_screenright');
  });
});

describe('shot plan', () => {
  const fb = (over: Partial<RepView>) => view({ phase: 'feedback', resolveMs: 500, repMs: 520, ...over });
  it('shooter mode: no shot until you tap; the ball leaves after the load', () => {
    expect(shotPlan(view())).toBeNull();
    expect(shotPlan(fb({ outcome: 'good', tapped: 'mid-right' }))).toMatchObject({ kind: 'goal', zone: 'mid-right', startMs: 620, contactAt: 1220, final: true });
  });
  it('shooter mode: a miss goes wide, clipping the pipe from the middle row; the bait and a timeout are saved', () => {
    expect(shotPlan(fb({ outcome: 'miss', tapped: 'top-left' }))).toMatchObject({ kind: 'wide', nearPost: false });
    expect(shotPlan(fb({ outcome: 'miss', tapped: 'mid-right' }))).toMatchObject({ kind: 'wide', nearPost: true });
    expect(shotPlan(fb({ outcome: 'bait', tapped: 'top-left' }))!.kind).toBe('save');
    expect(shotPlan(fb({ outcome: 'timeout', tapped: null, resolveMs: 2000 }))).toMatchObject({ kind: 'save', zone: 'low-right', startMs: 2120 });
  });
  it('goalie mode: the shot leaves at the release point and only finishes once resolved', () => {
    const g = sc({ mode: 'goalie', cueType: 'hands-low', bestZone: 'low-left' });
    expect(shotPlan(view({ mode: 'goalie', scenario: g, repMs: 1500 }))).toMatchObject({ startMs: 1400, final: false, zone: 'low-left' });
    expect(shotPlan(view({ mode: 'goalie', scenario: g, phase: 'feedback', resolveMs: 1600, outcome: 'best', tapped: 'low-left', repMs: 1700 }))).toMatchObject({ kind: 'save', final: true });
    expect(shotPlan(view({ mode: 'goalie', scenario: g, phase: 'feedback', resolveMs: 1600, outcome: 'miss', tapped: 'top-right', repMs: 1700 }))).toMatchObject({ kind: 'goal', zone: 'low-left' });
  });
  it('goalie mode fake: an early tap does not pull the release forward', () => {
    const g = sc({ mode: 'goalie', cueType: 'stick-fake', fake: true, releaseMs: 1100, bestZone: 'low-left' });
    const v = view({ mode: 'goalie', scenario: g, timing: { windowMs: 1800, releaseMs: 1100 }, phase: 'feedback', resolveMs: 500, outcome: 'early', tapped: 'top-right', repMs: 1200 });
    expect(shotPlan(v)).toMatchObject({ startMs: 1100, kind: 'goal' });
  });
});
