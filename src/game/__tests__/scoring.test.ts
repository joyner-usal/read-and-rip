// One test per row of SPEC.md section 4, plus the bait and boundary cases.
import { describe, expect, it } from 'vitest';
import { addToRound, scoreRep, type RepTarget } from '../scoring';

const plain: RepTarget = { mode: 'shooter', fake: false, bestZone: 'low-right', goodZones: ['low-center', 'mid-right'], windowMs: 2000 };
const goalieFake: RepTarget = { mode: 'goalie', fake: true, bestZone: 'low-left', goodZones: ['low-center'], windowMs: 1800, releaseMs: 1100 };
const shooterFake: RepTarget = { mode: 'shooter', fake: true, bestZone: 'top-left', goodZones: ['mid-left'], windowMs: 2000, baitZone: 'top-right' };

describe('scoring rows (SPEC 4)', () => {
  it('best is +3', () => expect(scoreRep(plain, { zone: 'low-right', atMs: 1500 })).toEqual({ outcome: 'best', points: 3, speedBonus: false }));
  it('good is +1', () => expect(scoreRep(plain, { zone: 'mid-right', atMs: 1500 })).toEqual({ outcome: 'good', points: 1, speedBonus: false }));
  it('miss is 0', () => expect(scoreRep(plain, { zone: 'top-left', atMs: 300 })).toEqual({ outcome: 'miss', points: 0, speedBonus: false }));
  it('timeout is 0', () => expect(scoreRep(plain, null)).toEqual({ outcome: 'timeout', points: 0, speedBonus: false }));
  it('speed bonus adds +1 to best in the first half', () => expect(scoreRep(plain, { zone: 'low-right', atMs: 999 }).points).toBe(4));
  it('speed bonus adds +1 to good in the first half', () => expect(scoreRep(plain, { zone: 'low-center', atMs: 400 }).points).toBe(2));
  it('speed bonus counts exactly at the halfway mark', () => expect(scoreRep(plain, { zone: 'low-right', atMs: 1000 }).speedBonus).toBe(true));
  it('no speed bonus just past halfway', () => expect(scoreRep(plain, { zone: 'low-right', atMs: 1001 }).speedBonus).toBe(false));
  it('no speed bonus on a fast miss', () => expect(scoreRep(plain, { zone: 'top-left', atMs: 10 }).points).toBe(0));
});

describe('goalie fakes', () => {
  it('a tap before release is early, -1, even on the best zone', () =>
    expect(scoreRep(goalieFake, { zone: 'low-left', atMs: 1099 })).toEqual({ outcome: 'early', points: -1, speedBonus: false }));
  it('a tap at release scores normally', () => expect(scoreRep(goalieFake, { zone: 'low-left', atMs: 1100 }).outcome).toBe('best'));
  it('the -1 rule does not apply in shooter mode', () =>
    expect(scoreRep({ ...goalieFake, mode: 'shooter' }, { zone: 'low-left', atMs: 10 }).outcome).toBe('best'));
  it('a goalie scenario that is not a fake has no early rule', () =>
    expect(scoreRep({ ...goalieFake, fake: false }, { zone: 'low-left', atMs: 10 }).points).toBe(4));
});

describe('shooter fakes (D15)', () => {
  it('tapping the bait zone is "bait", 0', () =>
    expect(scoreRep(shooterFake, { zone: 'top-right', atMs: 300 })).toEqual({ outcome: 'bait', points: 0, speedBonus: false }));
  it('the bait zone is 0 late in the window too', () => expect(scoreRep(shooterFake, { zone: 'top-right', atMs: 1900 }).outcome).toBe('bait'));
  it('reading past the bait to the best zone early is best plus speed', () =>
    expect(scoreRep(shooterFake, { zone: 'top-left', atMs: 200 })).toEqual({ outcome: 'best', points: 4, speedBonus: true }));
  it('other zones are a plain miss', () => expect(scoreRep(shooterFake, { zone: 'low-center', atMs: 900 }).outcome).toBe('miss'));
  it('bait only applies to fakes', () => expect(scoreRep({ ...shooterFake, fake: false }, { zone: 'top-right', atMs: 300 }).outcome).toBe('miss'));
});

describe('round total', () => {
  it('never goes below 0', () => {
    expect(addToRound(0, -1)).toBe(0);
    expect(addToRound(2, -1)).toBe(1);
  });
});
