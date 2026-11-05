import { describe, expect, it } from 'vitest';
import { cameraAt, centerOf, goalieAt, goalieMoves, shooterAt, still, GOAL_FOCUS } from './motion';
import { READY, goalieCover, goalieSave, shotPlan, type RepView } from './poses';
import {
  FLIGHT_MS, GOALIE_DIP_MS, GOALIE_LEAN_RAD, GOALIE_STRETCH, GOALIE_TRAVEL_MS, LATE_EXTRA_MS, LOAD_MS, LUNGE, PUSH_IN, REACTION_MS,
  RELEASE_HOLD_MS, SHAKE, SMEAR_MS, shotSchedule
} from '../game/timing';
import { sc } from '../game/__tests__/fixtures';

const view = (over: Partial<RepView> = {}): RepView => ({
  mode: 'shooter', phase: 'reading', scenario: sc(), timing: { windowMs: 2000 }, repMs: 800, resolveMs: null, outcome: null, tapped: null, ...over
});
const resolved = (over: Partial<RepView>) => view({ phase: 'feedback', resolveMs: 600, ...over });
const parts = (v: RepView, reduced = false) => {
  const sched = shotSchedule(v.mode, v.scenario.fake, v.timing, v.resolveMs, reduced);
  return { sched, shot: shotPlan(v, reduced) };
};
const goalie = (v: RepView, reduced = false) => {
  const { sched, shot } = parts(v, reduced);
  return goalieAt(v, sched, shot, reduced);
};

describe('opponent goalie reaction (shooter mode)', () => {
  // Tap at 600: load to 720, release 720, contact 1320.
  const save = (repMs: number) => resolved({ outcome: 'timeout', tapped: null, resolveMs: 600, repMs });
  it('holds his cue pose until 120 ms after release', () => {
    const cue = still(goalieCover('low-right'));
    const before = goalie(save(720 + REACTION_MS - 1));
    expect([before.cx, before.cy, before.sprite]).toEqual([cue.cx, cue.cy, cue.sprite]);
    expect(goalie(save(720 + REACTION_MS + GOALIE_DIP_MS + 100)).cx).not.toBe(cue.cx);
  });
  it('dips first, then travels', () => {
    const cue = still(goalieCover('low-right'));
    const dip = goalie(save(720 + REACTION_MS + GOALIE_DIP_MS / 2));
    expect(dip.cy).toBeGreaterThan(cue.cy);
    expect(dip.cx).toBe(cue.cx);
  });
  it('is late on a goal: starts 180 ms later and is still reaching at contact', () => {
    const goal = (repMs: number) => resolved({ outcome: 'best', tapped: 'low-right', resolveMs: 600, repMs });
    const { sched } = parts(goal(0));
    const moves = goalieMoves(goal(0), sched, shotPlan(goal(0)));
    const react = moves.at(-1)!;
    expect(react.start).toBe(sched.releaseAt + REACTION_MS + LATE_EXTRA_MS);
    expect(react.start + GOALIE_DIP_MS + GOALIE_TRAVEL_MS).toBeGreaterThan(sched.contactAt);
    expect(react.to.sprite).toBe(goalieSave('low-right', 'gray').sprite); // reaching toward the ball
  });
  it('reduced motion: the reaction lands on the contact still frame', () => {
    const v = resolved({ outcome: 'best', tapped: 'low-right', resolveMs: 600, repMs: 0 });
    const { sched, shot } = parts(v, true);
    expect(goalieMoves(v, sched, shot, true).at(-1)!.start).toBe(sched.contactAt);
  });
  it('a wide shot draws only a partial reach', () => {
    const v = resolved({ outcome: 'miss', tapped: 'top-left', resolveMs: 600, repMs: 0 });
    const { sched, shot } = parts(v);
    expect(goalieMoves(v, sched, shot).at(-1)!.reach).toBeLessThan(1);
  });
});

describe('your goalie (goalie mode)', () => {
  const g = sc({ mode: 'goalie', cueType: 'hands-high', bestZone: 'top-left' });
  const at = (repMs: number) => view({ mode: 'goalie', scenario: g, phase: 'feedback', resolveMs: 700, outcome: 'best', tapped: 'top-left', repMs });
  it('starts moving the instant you tap', () => {
    expect(goalieMoves(at(700), null, null)[0].start).toBe(700);
    expect(goalie(at(699 + 0)).cy).toBe(still(READY).cy);
    expect(goalie(at(700 + GOALIE_DIP_MS / 2)).cy).toBeGreaterThan(still(READY).cy);
  });
  it('swaps sprite at the middle of the travel, with one smear frame, no crossfade', () => {
    const start = 700 + GOALIE_DIP_MS;
    expect(goalie(at(start + 40)).sprite).toBe('goalie_gray_ready_high_screenleft');
    const after = goalie(at(start + GOALIE_TRAVEL_MS / 2 + 2));
    expect(after.sprite).toBe('goalie_navy_dive_screenleft');
    expect(after.smear).not.toBeNull();
    expect(goalie(at(start + GOALIE_TRAVEL_MS / 2 + SMEAR_MS + 10)).smear).toBeNull();
  });
  it('arrives with a lean toward the zone and a 1.08 stretch', () => {
    const end = goalie(at(700 + GOALIE_DIP_MS + GOALIE_TRAVEL_MS + 50));
    const target = centerOf(goalieSave('top-left', 'navy'));
    expect(end.cx).toBeCloseTo(target.x);
    expect(end.cy).toBeCloseTo(target.y);
    expect(end.scale).toBeCloseTo(GOALIE_STRETCH);
    expect(Math.abs(end.rot)).toBeCloseTo(GOALIE_LEAN_RAD);
    expect(Math.sign(end.rot)).toBe(-1); // toward screen left
  });
  it('reduced motion: no travel, just the end pose', () => {
    const r = goalie(at(701), true);
    expect(r.sprite).toBe('goalie_navy_dive_screenleft');
    expect(r.smear).toBeNull();
  });
});

describe('shooter', () => {
  const tap = (repMs: number) => resolved({ outcome: 'best', tapped: 'low-right', resolveMs: 600, repMs });
  const shooter = (v: RepView, reduced = false) => shooterAt(v, parts(v, reduced).sched, reduced);
  it('carry in set up, cocked through the read', () => {
    expect(shooterAt(view({ phase: 'setup', repMs: -200 }), null, false).sprite).toBe('shooter_navy_carry');
    expect(shooterAt(view({ repMs: 400 }), null, false).sprite).toBe('shooter_navy_cocked');
  });
  it('loads for 120 ms: rotates back and rises', () => {
    const rest = shooter(tap(600));
    const loaded = shooter(tap(600 + LOAD_MS - 1));
    expect(loaded.sprite).toBe('shooter_navy_cocked');
    expect(loaded.rot).toBeLessThan(rest.rot);
    expect(loaded.cy).toBeLessThan(rest.cy);
  });
  it('hard swaps to release with a forward lunge, holds 160 ms, then follows', () => {
    const rel = shooter(tap(600 + LOAD_MS + 100));
    expect(rel.sprite).toBe('shooter_navy_release');
    expect(rel.scale).toBeCloseTo(LUNGE.scale);
    expect(shooter(tap(600 + LOAD_MS + 1)).smear).not.toBeNull();
    expect(shooter(tap(600 + LOAD_MS + RELEASE_HOLD_MS)).sprite).toBe('shooter_navy_follow');
  });
  it('goalie mode uses the gray number 12 shooter', () => {
    const g = sc({ mode: 'goalie', cueType: 'hands-low' });
    const v = (repMs: number) => view({ mode: 'goalie', scenario: g, repMs });
    expect(shooter(v(300)).sprite).toBe('shooter_gray_cocked');
    expect(shooter(v(1450)).sprite).toBe('shooter_gray_release');
  });
});

describe('camera', () => {
  it('pushes in slowly toward the goal while reading, up to 3%', () => {
    const v = (repMs: number) => view({ repMs });
    expect(cameraAt(v(0), null, null, false).zoom).toBe(1);
    expect(cameraAt(v(1000), null, null, false).zoom).toBeGreaterThan(1);
    expect(cameraAt(v(2000), null, null, false).zoom).toBeCloseTo(1 + PUSH_IN);
    expect(cameraAt(v(1000), null, null, false).focus).toEqual(GOAL_FOCUS);
  });
  it('eases back out over the flight and shakes on a goal', () => {
    const v = (repMs: number) => resolved({ outcome: 'best', tapped: 'low-right', repMs });
    const { sched, shot } = parts(v(0));
    expect(cameraAt(v(sched.releaseAt + FLIGHT_MS), sched, shot, false).zoom).toBeCloseTo(1);
    const shake = cameraAt(v(sched.contactAt + 10), sched, shot, false).shake;
    expect(Math.hypot(shake.x, shake.y)).toBeGreaterThan(0);
    expect(Math.hypot(shake.x, shake.y)).toBeLessThanOrEqual(SHAKE.goal.px);
    expect(cameraAt(v(sched.contactAt + SHAKE.goal.ms + 1), sched, shot, false).shake).toEqual({ x: 0, y: 0 });
  });
  it('reduced motion: no push-in and no shake', () => {
    const v = resolved({ outcome: 'best', tapped: 'low-right', repMs: 1330 });
    const { sched, shot } = parts(v, true);
    expect(cameraAt(v, sched, shot, true)).toMatchObject({ zoom: 1, shake: { x: 0, y: 0 } });
  });
});
