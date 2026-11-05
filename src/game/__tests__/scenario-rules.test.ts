import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS module shared with the CLI validator
import { crossChecks } from '../../../scripts/scenario-rules.mjs';
import { sc } from './fixtures';

const errs = (o: object) => crossChecks(sc(o as never)).errors as string[];
const warns = (o: object) => crossChecks(sc(o as never)).warnings as string[];

describe('validator rules', () => {
  it('passes a clean scenario', () => expect(crossChecks(sc())).toEqual({ errors: [], warnings: [] }));
  it('shooter fake needs baitZone and closeMs', () => {
    expect(errs({ fake: true }).join()).toMatch(/needs baitZone/);
    expect(errs({ fake: true }).join()).toMatch(/needs closeMs/);
    expect(errs({ fake: true, baitZone: 'top-left', closeMs: 900 })).toEqual([]);
  });
  it('closeMs must be inside the window', () => expect(errs({ fake: true, baitZone: 'top-left', closeMs: 2000 }).join()).toMatch(/closeMs must be inside/));
  it('baitZone cannot be the best or a good zone', () => {
    expect(errs({ fake: true, baitZone: 'low-right', closeMs: 900 }).join()).toMatch(/baitZone must not/);
    expect(errs({ fake: true, baitZone: 'mid-right', closeMs: 900 }).join()).toMatch(/baitZone must not/);
  });
  it('goalie fake needs releaseMs and no bait fields', () => {
    const g = { id: 'boys-goalie-t-001', mode: 'goalie', cueType: 'stick-fake', fake: true };
    expect(errs(g).join()).toMatch(/needs releaseMs/);
    expect(errs({ ...g, releaseMs: 900 })).toEqual([]);
    expect(errs({ ...g, releaseMs: 900, baitZone: 'top-left' }).join()).toMatch(/baitZone is only/);
  });
  it('timing fields are rejected on non-fakes', () => {
    expect(errs({ closeMs: 500 }).join()).toMatch(/closeMs is only/);
    expect(errs({ releaseMs: 500 }).join()).toMatch(/releaseMs is only/);
  });
  it('reserves the -m suffix', () => expect(errs({ id: 'boys-shooter-x-m' }).join()).toMatch(/must not end in "-m"/));
  it('warns, not fails, on side words when mirrored', () => {
    for (const w of ['left', 'Right', 'strong hand', 'weak hand', 'hash', 'wing', 'near side', 'far side']) {
      expect(warns({ rulesNote: `Look to the ${w} here.` })).toHaveLength(1);
      expect(errs({ rulesNote: `Look to the ${w} here.` })).toEqual([]);
    }
  });
  it('no side-word warning when mirror is false, or on look-alike words', () => {
    expect(warns({ rulesNote: 'Shoot left side.', mirror: false })).toEqual([]);
    expect(warns({ rulesNote: 'Bright, leftover, wingspan words.' })).toEqual([]);
  });
  it('asks goalie-mode scenarios to hold their mirror back (D16 amendment)', () => {
    const g = { id: 'boys-goalie-t-001', mode: 'goalie', cueType: 'hands-low' };
    expect(warns(g).join()).toMatch(/mirrorReady/);
    expect(warns({ ...g, mirrorReady: false })).toEqual([]);
    expect(warns({ ...g, mirror: false })).toEqual([]);
  });
  it('flags boys goalie-mode lefties, which the art cannot show yet', () => {
    expect(warns({ id: 'boys-goalie-t-001', mode: 'goalie', cueType: 'hands-low', mirrorReady: false, shooterHand: 'left' }).join()).toMatch(/held back/);
  });
  it('no side-word warning when the mirror is held back', () => expect(warns({ id: 'boys-goalie-t-001', mode: 'goalie', cueType: 'hands-low', mirrorReady: false, rulesNote: 'Watch the right hand.' })).toEqual([]));
  it('bans dashes in rules notes', () => expect(errs({ rulesNote: 'Stay set -- then go.' }).join()).toMatch(/em dash/));
});
