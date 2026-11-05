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

// ---- Feedback card (Phase 1.5, style frame). Proposed wording, pending Marty (BUILD.md). ----

const CARD_WORD: Record<Mode, Record<Outcome, string>> = {
  shooter: { best: 'Goal', good: 'Goal', miss: 'Wide', timeout: 'Too late', early: 'Too early', bait: 'Took the bait' },
  goalie: { best: 'Save', good: 'Save', miss: 'Scored on', timeout: 'Too late', early: 'Bit on the fake', bait: 'Took the bait' }
};

export const cardWord = (outcome: Outcome, mode: Mode): string => CARD_WORD[mode][outcome];

export const cardPoints = (points: number): string => signed(points);

/** Scoring chips: what earned (or cost) the points, always in words. */
export function cardChips(outcome: Outcome, speedBonus: boolean): string[] {
  const chips: string[] = [];
  if (outcome === 'best') chips.push('Best spot +3');
  if (outcome === 'good') chips.push('Good spot +1');
  if (speedBonus) chips.push('Fast read +1');
  if (outcome === 'miss') chips.push('Missed the read 0');
  if (outcome === 'timeout') chips.push('No tap 0');
  if (outcome === 'early') chips.push('Early tap -1');
  if (outcome === 'bait') chips.push('Bait spot 0');
  return chips;
}
