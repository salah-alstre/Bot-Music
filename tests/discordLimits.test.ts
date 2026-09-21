import type { Player } from 'lavalink-client';
import { describe, expect, it } from 'vitest';
import { commands } from '../src/commands/index.js';
import { buildPanelComponents } from '../src/components/controls.js';
import { idleEmbed, nowPlayingEmbed } from '../src/components/embeds/player.js';
import { buildQueueView } from '../src/components/embeds/queue.js';
import { defaultSettings } from '../src/database/settings.js';
import { COMMAND_CATEGORIES } from '../src/types/index.js';

const REQUIRED_COMMANDS = [
  'play', 'search', 'pause', 'resume', 'skip', 'previous', 'stop', 'leave', 'join', 'queue', 'nowplaying', 'remove', 'clear',
  'shuffle', 'loop', 'volume', 'seek', 'autoplay', 'filter', 'lyrics', 'help', 'ping', 'about', 'setup',
];

function fakePlayer(overrides: Record<string, unknown> = {}): Player {
  const track = (i: number) => ({
    encoded: `enc${i}`,
    info: {
      identifier: `id${i}`,
      title: `Track ${i} `.repeat(30),
      author: 'Artist - Topic',
      duration: 200_000,
      artworkUrl: 'https://img.example/a.png',
      uri: `https://youtube.com/watch?v=${i}`,
      sourceName: 'youtube',
      isSeekable: true,
      isStream: false,
      isrc: null,
    },
    pluginInfo: {},
    requester: { id: '1', username: 'Tester', avatarUrl: null },
  });
  return {
    guildId: '1',
    paused: false,
    playing: true,
    volume: 80,
    position: 65_000,
    repeatMode: 'off',
    node: { info: { filters: ['equalizer', 'timescale', 'rotation', 'karaoke', 'tremolo', 'vibrato'] } },
    filterManager: {
      equalizerBands: [],
      filters: { nightcore: false, vaporwave: false, rotation: false, karaoke: false, tremolo: false, vibrato: false },
    },
    queue: { current: track(0), tracks: Array.from({ length: 35 }, (_, i) => track(i + 1)), previous: [track(99)] },
    ...overrides,
  } as unknown as Player;
}

describe('slash commands', () => {
  it('registers every required command exactly once', () => {
    const names = commands.map((c) => c.data.name);
    expect(new Set(names).size).toBe(names.length);
    for (const required of REQUIRED_COMMANDS) expect(names).toContain(required);
  });

  it('produces valid Discord payloads', () => {
    expect(commands.length).toBeLessThanOrEqual(100);
    for (const command of commands) {
      const json = command.data.toJSON();
      expect(json.name).toMatch(/^[\w-]{1,32}$/);
      expect(json.description.length).toBeGreaterThan(0);
      expect(json.description.length).toBeLessThanOrEqual(100);
      expect(COMMAND_CATEGORIES).toContain(command.category);
    }
  });
});

describe('control panel', () => {
  it('stays within Discord component limits', () => {
    const rows = buildPanelComponents(fakePlayer(), { autoplay: true } as never, defaultSettings('1'));
    expect(rows.length).toBeLessThanOrEqual(5);
    for (const row of rows) expect(row.components.length).toBeLessThanOrEqual(5);
    const ids = rows.flatMap((r) => r.toJSON().components.map((c) => ('custom_id' in c ? c.custom_id : '')));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('hides the filter menu when filters are disallowed', () => {
    const settings = { ...defaultSettings('1'), allowFilters: false };
    expect(buildPanelComponents(fakePlayer(), undefined, settings)).toHaveLength(3);
  });

  it('renders a now playing embed within embed limits', () => {
    const json = nowPlayingEmbed(fakePlayer(), { autoplay: true } as never).toJSON();
    expect(json.title?.length).toBeLessThanOrEqual(256);
    expect(json.fields?.length).toBeLessThanOrEqual(25);
    for (const field of json.fields ?? []) {
      expect(field.name.length).toBeLessThanOrEqual(256);
      expect(field.value.length).toBeLessThanOrEqual(1024);
    }
    expect(json.description).toContain('1:05');
  });

  it('renders the idle embed', () => {
    expect(idleEmbed().toJSON().title).toBe('Nothing is playing');
  });
});

describe('queue view', () => {
  it('paginates a large queue and stays readable', () => {
    const first = buildQueueView(fakePlayer(), 1);
    expect(first.embeds[0]?.toJSON().description?.length).toBeLessThan(4000);
    expect(first.components).toHaveLength(1);
    const last = buildQueueView(fakePlayer(), 99);
    expect(last.embeds[0]?.toJSON().footer?.text).toContain('Page 4/4');
  });
  it('omits navigation for short queues', () => {
    const player = fakePlayer();
    player.queue.tracks.splice(3);
    expect(buildQueueView(player, 1).components).toHaveLength(0);
  });
});
