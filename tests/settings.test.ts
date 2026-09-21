import { describe, expect, it } from 'vitest';
import { openDatabase } from '../src/database/database.js';
import { clampInt, defaultSettings, parseLoopMode, settingsFromRow } from '../src/database/settings.js';
import { SettingsStore } from '../src/database/settingsStore.js';

const GUILD = '123456789012345678';

describe('settings parsing', () => {
  it('parses loop modes defensively', () => {
    expect(parseLoopMode('track')).toBe('track');
    expect(parseLoopMode('queue')).toBe('queue');
    expect(parseLoopMode('garbage')).toBe('off');
    expect(parseLoopMode(undefined)).toBe('off');
  });

  it('clamps integers with a fallback', () => {
    expect(clampInt(500, 0, 200, 80)).toBe(200);
    expect(clampInt('nope', 0, 200, 80)).toBe(80);
    expect(clampInt(-5, 0, 200, 80)).toBe(0);
  });

  it('returns defaults for a missing row', () => {
    expect(settingsFromRow(GUILD, undefined)).toEqual(defaultSettings(GUILD));
  });

  it('sanitizes corrupt rows', () => {
    const settings = settingsFromRow(GUILD, {
      dj_role_id: 'not-an-id',
      default_volume: 9999,
      max_volume: 120,
      idle_timeout_seconds: 1,
      default_loop: 'weird',
      allow_filters: 0,
      autoplay_default: 1,
    });
    expect(settings.djRoleId).toBeNull();
    expect(settings.maxVolume).toBe(120);
    expect(settings.defaultVolume).toBe(120);
    expect(settings.idleTimeoutSeconds).toBe(30);
    expect(settings.defaultLoop).toBe('off');
    expect(settings.allowFilters).toBe(false);
    expect(settings.autoplayDefault).toBe(true);
  });
});

describe('SettingsStore', () => {
  it('persists partial updates and caches them', () => {
    const db = openDatabase(':memory:');
    const store = new SettingsStore(db);
    expect(store.get(GUILD)).toEqual(defaultSettings(GUILD));

    store.update(GUILD, { djRoleId: '999999999999999999', defaultVolume: 55, autoplayDefault: true });
    store.update(GUILD, { defaultLoop: 'queue' });

    const fresh = new SettingsStore(db).get(GUILD);
    expect(fresh).toMatchObject({ djRoleId: '999999999999999999', defaultVolume: 55, autoplayDefault: true, defaultLoop: 'queue', allowFilters: true });
  });

  it('lists controllers and resets settings', () => {
    const store = new SettingsStore(openDatabase(':memory:'));
    store.update(GUILD, { controllerChannelId: '111111111111111111', controllerMessageId: '222222222222222222' });
    expect(store.controllers()).toEqual([{ guildId: GUILD, channelId: '111111111111111111', messageId: '222222222222222222' }]);

    store.reset(GUILD);
    expect(store.controllers()).toEqual([]);
    expect(store.get(GUILD)).toEqual(defaultSettings(GUILD));
  });

  it('keeps guilds isolated', () => {
    const store = new SettingsStore(openDatabase(':memory:'));
    store.update('111111111111111111', { defaultVolume: 10 });
    expect(store.get('222222222222222222').defaultVolume).toBe(defaultSettings('x').defaultVolume);
  });
});
