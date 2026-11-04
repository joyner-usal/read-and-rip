import { ZONES, type Zone } from '../scenarios/types';

export type Row = 'top' | 'mid' | 'low';
export type Col = 'left' | 'center' | 'right';

export function zoneParts(z: Zone): { row: Row; col: Col } {
  const [row, col] = z.split('-') as [Row, Col];
  return { row, col };
}

/** -1 left, 0 center, 1 right (shooter's view). */
export function colIndex(z: Zone): -1 | 0 | 1 {
  const { col } = zoneParts(z);
  return col === 'left' ? -1 : col === 'right' ? 1 : 0;
}

/** -1 top, 0 mid, 1 low. */
export function rowIndex(z: Zone): -1 | 0 | 1 {
  const { row } = zoneParts(z);
  return row === 'top' ? -1 : row === 'low' ? 1 : 0;
}

/** Key number 1 to 9 in reading order. */
export function zoneKey(z: Zone): number {
  return ZONES.indexOf(z) + 1;
}

export function zoneFromKey(key: string): Zone | null {
  const n = Number(key);
  return Number.isInteger(n) && n >= 1 && n <= 9 ? ZONES[n - 1] : null;
}

export function mirrorZone(z: Zone): Zone {
  const { row, col } = zoneParts(z);
  const flipped: Col = col === 'left' ? 'right' : col === 'right' ? 'left' : 'center';
  return `${row}-${flipped}` as Zone;
}

/** "low right" */
export function zoneLabel(z: Zone): string {
  return z.replace('-', ' ');
}

/** The same zone named from the goalie's side: the shooter's right is the goalie's left. */
export function goalieLabel(z: Zone): string {
  return zoneLabel(mirrorZone(z));
}
