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

import { cardChips, cardPoints, cardWord } from '../copy';

describe('feedback card words', () => {
  it('names the result for each mode', () => {
    expect(cardWord('best', 'goalie')).toBe('Save');
    expect(cardWord('good', 'shooter')).toBe('Goal');
    expect(cardWord('miss', 'shooter')).toBe('Wide');
    expect(cardWord('bait', 'shooter')).toBe('Took the bait');
    expect(cardWord('early', 'goalie')).toBe('Bit on the fake');
  });
  it('lists every point in words', () => {
    expect(cardChips('best', true)).toEqual(['Best spot +3', 'Fast read +1']);
    expect(cardChips('good', false)).toEqual(['Good spot +1']);
    expect(cardChips('early', false)).toEqual(['Early tap -1']);
    expect(cardChips('bait', false)).toEqual(['Bait spot 0']);
  });
  it('signs the points', () => {
    expect(cardPoints(4)).toBe('+4');
    expect(cardPoints(0)).toBe('0');
    expect(cardPoints(-1)).toBe('-1');
  });
});
