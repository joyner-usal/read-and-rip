import { describe, expect, it } from 'vitest';
import { resultHeadline, zoneForMode } from '../copy';

describe('result words (SPEC 8)', () => {
  it.each([
    ['best', 3, false, 'Best +3'], ['good', 1, false, 'Good +1'], ['miss', 0, false, 'Miss 0'], ['timeout', 0, false, 'Too late 0'],
    ['early', -1, false, 'Bit on the fake -1'], ['bait', 0, false, 'Took the bait 0'], ['best', 4, true, 'Best +3'], ['good', 2, true, 'Good +1']
  ] as const)('%s %i (speed %s) reads "%s"', (o, p, sp, text) => expect(resultHeadline(o, p, sp)).toBe(text));
  it('goalie mode names both sides', () => expect(zoneForMode('low-right', 'goalie')).toBe('Low right (your low left as the goalie)'));
  it('shooter mode names one side', () => expect(zoneForMode('top-left', 'shooter')).toBe('Top left'));
});
