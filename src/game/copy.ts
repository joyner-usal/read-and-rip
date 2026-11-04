// Player-facing words for results (SPEC.md section 8). No em dashes.
import type { Mode, Zone } from '../scenarios/types';
import type { Outcome } from './scoring';
import { goalieLabel, zoneLabel } from './zones';

const WORD: Record<Outcome, string> = {
  best: 'Best',
  good: 'Good',
  miss: 'Miss',
  timeout: 'Too late',
  early: 'Bit on the fake',
  bait: 'Took the bait'
};

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** "Best +3", "Took the bait 0". With a speed bonus the base points show and the bonus is its own line. */
export function resultHeadline(outcome: Outcome, points: number, speedBonus: boolean): string {
  return `${WORD[outcome]} ${signed(speedBonus ? points - 1 : points)}`;
}

export const SPEED_LINE = 'Speed bonus +1';

/** "Low right" in shooter mode; "Low right (your low left as the goalie)" in goalie mode. */
export function zoneForMode(z: Zone, mode: Mode): string {
  const s = zoneLabel(z);
  const cap = s[0].toUpperCase() + s.slice(1);
  return mode === 'goalie' ? `${cap} (your ${goalieLabel(z)} as the goalie)` : cap;
}

export function bestLine(best: Zone, mode: Mode): string {
  return `Best spot: ${zoneForMode(best, mode)}`;
}
