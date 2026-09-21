import type { Player } from 'lavalink-client';
import { describe, expect, it } from 'vitest';
import { activeFilter, applyFilter, FILTERS, findFilter, hasEqualizer, supportedFilters } from '../src/music/filters.js';

/** Mimics lavalink-client's FilterManager quirks: resetFilters() leaves the equalizer, clearEQ() leaves zero-gain bands. */
function fakePlayer() {
  const calls: string[] = [];
  const manager = {
    equalizerBands: [] as { band: number; gain: number }[],
    filters: { nightcore: false, vaporwave: false, rotation: false, karaoke: false, tremolo: false, vibrato: false },
    async resetFilters() {
      calls.push('reset');
      Object.assign(manager.filters, { nightcore: false, vaporwave: false, rotation: false, karaoke: false, tremolo: false, vibrato: false });
    },
    async clearEQ() {
      calls.push('clearEQ');
      manager.equalizerBands = Array.from({ length: 15 }, (_, band) => ({ band, gain: 0 }));
    },
    async setEQPreset() {
      calls.push('bassboost');
      manager.equalizerBands = [{ band: 0, gain: 0.3 }, { band: 1, gain: 0.2 }];
    },
    async toggleNightcore() {
      calls.push('nightcore');
      manager.filters.nightcore = !manager.filters.nightcore;
    },
    async toggleRotation() {
      manager.filters.rotation = !manager.filters.rotation;
    },
  };
  return { player: { filterManager: manager } as unknown as Player, calls };
}

describe('applying filters', () => {
  it('switches between filters without leaving the equalizer behind', async () => {
    const { player, calls } = fakePlayer();
    await applyFilter(player, 'bassboost');
    expect(activeFilter(player)?.key).toBe('bassboost');

    await applyFilter(player, 'nightcore');
    expect(calls).toContain('clearEQ');
    expect(hasEqualizer(player)).toBe(false);
    expect(activeFilter(player)?.key).toBe('nightcore');
  });

  it('turns the active filter off when it is selected again', async () => {
    const { player } = fakePlayer();
    expect((await applyFilter(player, 'nightcore')).active?.key).toBe('nightcore');
    expect((await applyFilter(player, 'nightcore')).active).toBeNull();
    expect(activeFilter(player)).toBeUndefined();
  });

  it('clears everything, including a zero-gain equalizer', async () => {
    const { player } = fakePlayer();
    await applyFilter(player, 'bassboost');
    expect((await applyFilter(player, 'clear')).active).toBeNull();
    expect(activeFilter(player)).toBeUndefined();
    expect(hasEqualizer(player)).toBe(false);
  });

  it('rejects unknown filters', async () => {
    await expect(applyFilter(fakePlayer().player, 'nope')).rejects.toThrow(RangeError);
  });
});

describe('filters', () => {
  it('exposes every required filter', () => {
    const keys = FILTERS.map((f) => f.key);
    for (const key of ['bassboost', 'nightcore', 'vaporwave', '8d', 'karaoke', 'tremolo', 'vibrato']) expect(keys).toContain(key);
  });
  it('only offers filters the node supports', () => {
    const limited = supportedFilters(undefined, ['equalizer', 'timescale']).map((f) => f.key);
    expect(limited.sort()).toEqual(['bassboost', 'nightcore', 'vaporwave']);
  });
  it('offers everything when the node supports everything', () => {
    const all = ['volume', 'equalizer', 'karaoke', 'timescale', 'tremolo', 'vibrato', 'rotation'];
    expect(supportedFilters(undefined, all)).toHaveLength(FILTERS.length);
  });
  it('looks filters up by key', () => {
    expect(findFilter('8d')?.label).toBe('8D Audio');
    expect(findFilter('nope')).toBeUndefined();
  });
  it('has unique keys and Discord-safe option text', () => {
    expect(new Set(FILTERS.map((f) => f.key)).size).toBe(FILTERS.length);
    for (const f of FILTERS) {
      expect(f.label.length).toBeLessThanOrEqual(100);
      expect(f.description.length).toBeLessThanOrEqual(100);
    }
  });
});
