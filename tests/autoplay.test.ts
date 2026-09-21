import type { Track } from 'lavalink-client';
import { describe, expect, it } from 'vitest';
import { isAutoplayCandidate, normalizeTitle, pickFromPool } from '../src/music/autoplay.js';

const track = (duration: number, isStream = false) => ({ info: { duration, isStream } }) as unknown as Track;

describe('autoplay helpers', () => {
  it('filters unsuitable tracks', () => {
    expect(isAutoplayCandidate(track(200_000))).toBe(true);
    expect(isAutoplayCandidate(track(10_000))).toBe(false);
    expect(isAutoplayCandidate(track(3 * 3_600_000))).toBe(false);
    expect(isAutoplayCandidate(track(200_000, true))).toBe(false);
  });
  it('normalizes titles for duplicate detection', () => {
    expect(normalizeTitle('Do I Wanna Know? (Official Video)')).toBe(normalizeTitle('do i wanna know'));
  });
  it('picks from the top of the pool only', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(pickFromPool(items, 3, () => 0.99)).toBe(3);
    expect(pickFromPool(items, 3, () => 0)).toBe(1);
    expect(pickFromPool([], 3)).toBeUndefined();
  });
});
