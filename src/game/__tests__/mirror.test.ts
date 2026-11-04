import { describe, expect, it } from 'vitest';
import { mirrorScenario, withMirrors } from '../mirror';
import { goalieLabel, mirrorZone, zoneFromKey, zoneKey } from '../zones';
import { sc } from './fixtures';

describe('mirroring (D16)', () => {
  it('flips angle, hand and every zone, and adds -m', () => {
    const m = mirrorScenario(sc({ fake: true, baitZone: 'top-left', closeMs: 900 }));
    expect(m).toMatchObject({
      id: 'boys-shooter-t-001-m', approachAngleDeg: 30, shooterHand: 'left',
      bestZone: 'low-left', goodZones: ['low-center', 'mid-left'], baitZone: 'top-right', closeMs: 900
    });
  });
  it('keeps 0 degrees as 0, not -0', () => expect(Object.is(mirrorScenario(sc({ approachAngleDeg: 0 })).approachAngleDeg, 0)).toBe(true));
  it('mirroring twice gives the original zones back', () => {
    const s = sc();
    const mm = mirrorScenario(mirrorScenario(s));
    expect([mm.bestZone, mm.goodZones, mm.shooterHand, mm.approachAngleDeg]).toEqual([s.bestZone, s.goodZones, s.shooterHand, s.approachAngleDeg]);
  });
  it('mirrors by default and counts copies in the pool', () => expect(withMirrors([sc(), sc({ id: 'b' })]).map(s => s.id)).toEqual(['boys-shooter-t-001', 'boys-shooter-t-001-m', 'b', 'b-m']));
  it('honors mirror: false', () => expect(withMirrors([sc({ mirror: false })])).toHaveLength(1));
  it('mirror: true behaves like the default', () => expect(withMirrors([sc({ mirror: true })])).toHaveLength(2));
});

describe('zones', () => {
  it('center column stays put', () => expect(mirrorZone('mid-center')).toBe('mid-center'));
  it('keys 1 to 9 run in reading order', () => {
    expect(zoneFromKey('1')).toBe('top-left');
    expect(zoneFromKey('9')).toBe('low-right');
    expect(zoneFromKey('0')).toBeNull();
    expect(zoneKey('mid-center')).toBe(5);
  });
  it("names the goalie's side", () => expect(goalieLabel('low-right')).toBe('low left'));
});
