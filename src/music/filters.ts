import type { Player } from 'lavalink-client';

export type FilterKey = 'bassboost' | 'nightcore' | 'vaporwave' | '8d' | 'karaoke' | 'tremolo' | 'vibrato';

export interface FilterDefinition {
  key: FilterKey;
  label: string;
  emoji: string;
  description: string;
  /** Lavalink filter names that must be enabled on the node, otherwise the option is hidden. */
  requires: string[];
  apply(player: Player): Promise<unknown>;
  isActive(player: Player): boolean;
}

/** clearEQ() leaves 15 zero-gain bands behind, so "active" means at least one band is actually shaping the sound. */
export function hasEqualizer(player: Player): boolean {
  return player.filterManager.equalizerBands.some((band) => band && band.gain !== 0);
}

/** resetFilters() does not touch the equalizer, so it has to be cleared separately. */
async function resetAllFilters(player: Player): Promise<void> {
  const hadEqualizer = hasEqualizer(player);
  await player.filterManager.resetFilters();
  if (hadEqualizer) await player.filterManager.clearEQ();
}

export const FILTERS: readonly FilterDefinition[] = [
  {
    key: 'bassboost',
    label: 'Bass Boost',
    emoji: '🔊',
    description: 'Adds low-end punch with a gentle equalizer curve.',
    requires: ['equalizer'],
    apply: (p) => p.filterManager.setEQPreset('BassboostMedium'),
    isActive: hasEqualizer,
  },
  {
    key: 'nightcore',
    label: 'Nightcore',
    emoji: '🌙',
    description: 'Faster tempo with a higher pitch.',
    requires: ['timescale'],
    apply: (p) => p.filterManager.toggleNightcore(),
    isActive: (p) => p.filterManager.filters.nightcore,
  },
  {
    key: 'vaporwave',
    label: 'Vaporwave',
    emoji: '🌴',
    description: 'Slower, dreamier and lower in pitch.',
    requires: ['timescale'],
    apply: (p) => p.filterManager.toggleVaporwave(),
    isActive: (p) => p.filterManager.filters.vaporwave,
  },
  {
    key: '8d',
    label: '8D Audio',
    emoji: '🎧',
    description: 'Rotates the sound around your head. Best with headphones.',
    requires: ['rotation'],
    apply: (p) => p.filterManager.toggleRotation(0.2),
    isActive: (p) => p.filterManager.filters.rotation,
  },
  {
    key: 'karaoke',
    label: 'Karaoke',
    emoji: '🎤',
    description: 'Reduces vocals so you can sing along.',
    requires: ['karaoke'],
    apply: (p) => p.filterManager.toggleKaraoke(),
    isActive: (p) => p.filterManager.filters.karaoke,
  },
  {
    key: 'tremolo',
    label: 'Tremolo',
    emoji: '〰️',
    description: 'Rapid volume oscillation.',
    requires: ['tremolo'],
    apply: (p) => p.filterManager.toggleTremolo(),
    isActive: (p) => p.filterManager.filters.tremolo,
  },
  {
    key: 'vibrato',
    label: 'Vibrato',
    emoji: '🎻',
    description: 'Rapid pitch oscillation.',
    requires: ['vibrato'],
    apply: (p) => p.filterManager.toggleVibrato(),
    isActive: (p) => p.filterManager.filters.vibrato,
  },
];

export const CLEAR_FILTER_VALUE = 'clear';

export function findFilter(key: string): FilterDefinition | undefined {
  return FILTERS.find((filter) => filter.key === key);
}

/** Only filters the connected Lavalink node reports as enabled are offered to users. */
export function supportedFilters(player: Player | undefined, nodeFilters?: readonly string[]): FilterDefinition[] {
  const available = nodeFilters ?? player?.node.info?.filters;
  if (!available) return [...FILTERS];
  return FILTERS.filter((filter) => filter.requires.every((name) => available.includes(name)));
}

export function activeFilter(player: Player): FilterDefinition | undefined {
  return FILTERS.find((filter) => filter.isActive(player));
}

/**
 * Filters are applied one at a time: combining timescale and EQ presets produces
 * unpredictable results, and a single active filter is much easier to reason about in the UI.
 * Selecting the active filter again turns it off.
 */
export async function applyFilter(player: Player, key: string): Promise<{ active: FilterDefinition | null }> {
  if (key === CLEAR_FILTER_VALUE) {
    await resetAllFilters(player);
    return { active: null };
  }
  const definition = findFilter(key);
  if (!definition) throw new RangeError(`Unknown filter: ${key}`);

  const wasActive = definition.isActive(player);
  await resetAllFilters(player);
  if (wasActive) return { active: null };
  await definition.apply(player);
  return { active: definition };
}

