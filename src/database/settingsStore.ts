import type { DatabaseSync } from 'node:sqlite';
import { UserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import {
  defaultSettings,
  SETTINGS_COLUMNS,
  settingsFromRow,
  toColumnValue,
  type GuildSettings,
} from './settings.js';

export type SettingsPatch = Partial<Omit<GuildSettings, 'guildId'>>;

/**
 * Per-guild settings with a write-through cache. Reads never throw: a broken database
 * degrades to defaults so music keeps playing. Writes surface a friendly error instead.
 */
export class SettingsStore {
  private readonly cache = new Map<string, GuildSettings>();

  constructor(private readonly db: DatabaseSync) {}

  get(guildId: string): GuildSettings {
    const cached = this.cache.get(guildId);
    if (cached) return cached;

    let settings: GuildSettings;
    try {
      const row = this.db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
      settings = settingsFromRow(guildId, row as Record<string, unknown> | undefined);
    } catch (error) {
      logger.error({ err: error, guildId }, 'Failed to read guild settings, using defaults');
      return defaultSettings(guildId);
    }
    this.cache.set(guildId, settings);
    return settings;
  }

  update(guildId: string, patch: SettingsPatch): GuildSettings {
    const next: GuildSettings = { ...this.get(guildId), ...patch };
    const entries = Object.entries(patch) as [keyof typeof SETTINGS_COLUMNS, string | number | boolean | null][];
    if (entries.length === 0) return next;

    try {
      const columns = entries.map(([key]) => SETTINGS_COLUMNS[key]);
      const values = entries.map(([, value]) => toColumnValue(value));
      const assignments = columns.map((column) => `${column} = excluded.${column}`).join(', ');
      this.db
        .prepare(
          `INSERT INTO guild_settings (guild_id, ${columns.join(', ')}) VALUES (?, ${columns.map(() => '?').join(', ')})
           ON CONFLICT(guild_id) DO UPDATE SET ${assignments}, updated_at = CURRENT_TIMESTAMP`,
        )
        .run(guildId, ...values);
    } catch (error) {
      logger.error({ err: error, guildId }, 'Failed to save guild settings');
      throw new UserError('I could not save that setting right now. Please try again in a moment.');
    }

    this.cache.set(guildId, next);
    return next;
  }

  reset(guildId: string): GuildSettings {
    try {
      this.db.prepare('DELETE FROM guild_settings WHERE guild_id = ?').run(guildId);
    } catch (error) {
      logger.error({ err: error, guildId }, 'Failed to reset guild settings');
      throw new UserError('I could not reset the settings right now. Please try again in a moment.');
    }
    this.cache.delete(guildId);
    return this.get(guildId);
  }

  /** Guilds that have a persistent controller message that must be restored on startup. */
  controllers(): { guildId: string; channelId: string; messageId: string }[] {
    try {
      const rows = this.db
        .prepare('SELECT guild_id, controller_channel_id, controller_message_id FROM guild_settings WHERE controller_message_id IS NOT NULL')
        .all() as { guild_id: string; controller_channel_id: string; controller_message_id: string }[];
      return rows.map((r) => ({ guildId: r.guild_id, channelId: r.controller_channel_id, messageId: r.controller_message_id }));
    } catch (error) {
      logger.error({ err: error }, 'Failed to list persistent controllers');
      return [];
    }
  }
}
