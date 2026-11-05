import { describe, expect, it } from 'vitest';
import { nextDpr } from './Stage';

describe('adaptive resolution', () => {
  it('keeps the resolution while frames are fast', () => expect(nextDpr(2, 16.9)).toBe(2));
  it('steps down when the average misses about 55 fps', () => expect(nextDpr(1.5, 19.6)).toBe(1));
  it('steps 2 to 1.5 to 1 when frames run slow, and never below 1', () => {
    expect(nextDpr(2, 33)).toBe(1.5);
    expect(nextDpr(1.5, 33)).toBe(1);
    expect(nextDpr(1, 33)).toBe(1);
  });
  it('steps a 3x phone (capped to 2) down the same way', () => expect(nextDpr(2, 25)).toBe(1.5));
});
