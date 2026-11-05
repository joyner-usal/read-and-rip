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

/** Whether a scenario gets a mirrored copy: not when it opts out or isn't ready (D16). */
export const mirrors = (s: Scenario) => s.mirror !== false && s.mirrorReady !== false;

/**
 * The playable pool: each scenario plus its mirror. Mirrors flip zones and approach
 * data only; the art is never mirrored (D16 amendment).
 */
export function withMirrors(list: Scenario[]): Scenario[] {
  return list.flatMap(s => (mirrors(s) ? [s, mirrorScenario(s)] : [s]));
}
