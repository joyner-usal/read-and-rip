import type { Scenario } from '../../scenarios/types';

export function sc(over: Partial<Scenario> = {}): Scenario {
  return {
    schemaVersion: 1,
    id: 'boys-shooter-t-001',
    game: 'boys',
    mode: 'shooter',
    approachAngleDeg: -30,
    shooterHand: 'right',
    cueType: 'goalie-stick-high',
    fake: false,
    readWindowMs: 2000,
    bestZone: 'low-right',
    goodZones: ['low-center', 'mid-right'],
    difficulty: 1,
    rulesNote: 'Test scenario note.',
    status: 'draft',
    ...over
  };
}
