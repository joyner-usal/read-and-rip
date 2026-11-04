// Small seeded random generator (mulberry32) so rounds are reproducible in tests.
export function nextRandom(seed: number): [value: number, nextSeed: number] {
  const next = (seed + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

export function randomSeed(): number {
  return (Math.random() * 2 ** 32) >>> 0;
}
