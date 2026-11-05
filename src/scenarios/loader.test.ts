import { describe, expect, it } from 'vitest';
import { selectScenarios, allScenarios } from './loader';
import { sc } from '../game/__tests__/fixtures';

describe('scenario loader (D21)', () => {
  const list = [sc({ id: 'a', status: 'approved' }), sc({ id: 'b', status: 'draft' }), sc({ id: 'c', status: 'approved', mirror: false })];
  it('production keeps approved only, with mirrors', () =>
    expect(selectScenarios(list, false).map(s => s.id)).toEqual(['a', 'a-m', 'c']));
  it('dev keeps drafts too', () => expect(selectScenarios(list, true).map(s => s.id)).toEqual(['a', 'a-m', 'b', 'b-m', 'c']));
  it('holds back goalie-mode mirrors and boys goalie-mode lefties', () => {
    const g = [sc({ id: 'g', mode: 'goalie', status: 'approved', mirrorReady: false }), sc({ id: 'l', mode: 'goalie', status: 'approved', shooterHand: 'left', mirrorReady: false })];
    expect(selectScenarios(g, false).map(s => s.id)).toEqual(['g']);
  });
  it('finds the scenario files on disk', () => expect(allScenarios.length).toBeGreaterThanOrEqual(18));
});
