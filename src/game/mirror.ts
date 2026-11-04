// Left to right copies (D16). A mirror flips the angle, the hand and every zone.
import type { Scenario } from '../scenarios/types';
import { mirrorZone } from './zones';

export const MIRROR_SUFFIX = '-m';

export function mirrorScenario(s: Scenario): Scenario {
  const m: Scenario = {
    ...s,
    id: `${s.id}${MIRROR_SUFFIX}`,
    approachAngleDeg: s.approachAngleDeg === 0 ? 0 : -s.approachAngleDeg,
    shooterHand: s.shooterHand === 'right' ? 'left' : 'right',
    bestZone: mirrorZone(s.bestZone),
    goodZones: s.goodZones.map(mirrorZone)
  };
  if (s.baitZone) m.baitZone = mirrorZone(s.baitZone);
  return m;
}

export const isMirror = (s: Scenario) => s.id.endsWith(MIRROR_SUFFIX);

/** The playable pool: each scenario plus its mirror unless it opts out. */
export function withMirrors(list: Scenario[]): Scenario[] {
  return list.flatMap(s => (s.mirror === false ? [s] : [s, mirrorScenario(s)]));
}
