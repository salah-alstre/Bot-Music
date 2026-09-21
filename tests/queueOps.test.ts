import { describe, expect, it } from 'vitest';
import { clampVolume, moveItem, nextLoopMode, resolveRemovalRange, sumDurations, toZeroBased } from '../src/music/queueOps.js';

describe('toZeroBased', () => {
  it('converts valid positions', () => {
    expect(toZeroBased(1, 3)).toBe(0);
    expect(toZeroBased(3, 3)).toBe(2);
  });
  it('rejects invalid positions', () => {
    for (const bad of [0, 4, -1, 1.5, Number.NaN]) expect(toZeroBased(bad, 3)).toBeNull();
    expect(toZeroBased(1, 0)).toBeNull();
  });
});

describe('moveItem', () => {
  const list = ['a', 'b', 'c', 'd'];
  it('moves forward and backward without mutating the input', () => {
    expect(moveItem(list, 0, 2)?.items).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(list, 3, 0)?.items).toEqual(['d', 'a', 'b', 'c']);
    expect(list).toEqual(['a', 'b', 'c', 'd']);
  });
  it('returns the moved element', () => {
    expect(moveItem(list, 1, 3)?.moved).toBe('b');
  });
  it('rejects out of range indexes', () => {
    expect(moveItem(list, 4, 0)).toBeNull();
    expect(moveItem(list, 0, -1)).toBeNull();
  });
});

describe('resolveRemovalRange', () => {
  it('resolves single and range removals', () => {
    expect(resolveRemovalRange(2, null, 5)).toEqual({ index: 1, count: 1 });
    expect(resolveRemovalRange(2, 4, 5)).toEqual({ index: 1, count: 3 });
  });
  it('rejects bad ranges', () => {
    expect(resolveRemovalRange(6, null, 5)).toBeNull();
    expect(resolveRemovalRange(4, 2, 5)).toBeNull();
    expect(resolveRemovalRange(1, 9, 5)).toBeNull();
  });
});

describe('misc queue helpers', () => {
  it('sums durations ignoring invalid values', () => {
    expect(sumDurations([1000, 2000, Number.NaN, -5])).toBe(3000);
  });
  it('cycles loop modes', () => {
    expect(nextLoopMode('off')).toBe('track');
    expect(nextLoopMode('track')).toBe('queue');
    expect(nextLoopMode('queue')).toBe('off');
  });
  it('clamps volume', () => {
    expect(clampVolume(250, 150)).toBe(150);
    expect(clampVolume(-4, 150)).toBe(0);
    expect(clampVolume(Number.NaN, 150)).toBe(0);
    expect(clampVolume(49.6, 150)).toBe(50);
  });
});
