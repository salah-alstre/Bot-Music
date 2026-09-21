import { LIMITS } from '../config/brand.js';

export type LoopMode = 'off' | 'track' | 'queue';

export interface GuildSettings {
  guildId: string;
  djRoleId: string | null;
  defaultVolume: number;
  maxVolume: number;
  idleTimeoutSeconds: number;
  autoplayDefault: boolean;
  defaultLoop: LoopMode;
  allowFilters: boolean;
  requestChannelId: string | null;
  requestMessagesEnabled: boolean;
  controllerChannelId: string | null;
  controllerMessageId: string | null;
}

export function defaultSettings(guildId: string): GuildSettings {
  return {
    guildId,
    djRoleId: null,
    defaultVolume: LIMITS.defaultVolume,
    maxVolume: LIMITS.defaultMaxVolume,
    idleTimeoutSeconds: LIMITS.defaultIdleSeconds,
    autoplayDefault: false,
    defaultLoop: 'off',
    allowFilters: true,
    requestChannelId: null,
    requestMessagesEnabled: false,
    controllerChannelId: null,
    controllerMessageId: null,
  };
}

export function parseLoopMode(value: unknown): LoopMode {
  return value === 'track' || value === 'queue' ? value : 'off';
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

const nullableId = (value: unknown): string | null => (typeof value === 'string' && /^\d{17,20}$/.test(value) ? value : null);

/**
 * Turns a raw database row into validated settings. Anything corrupt or out of range
 * is replaced by a safe default so a bad row can never break playback.
 */
export function settingsFromRow(guildId: string, row: Record<string, unknown> | undefined): GuildSettings {
  const defaults = defaultSettings(guildId);
  if (!row) return defaults;

  const maxVolume = clampInt(row.max_volume, 10, LIMITS.absoluteMaxVolume, defaults.maxVolume);
  return {
    guildId,
    djRoleId: nullableId(row.dj_role_id),
    maxVolume,
    defaultVolume: clampInt(row.default_volume, LIMITS.minVolume, maxVolume, Math.min(defaults.defaultVolume, maxVolume)),
    idleTimeoutSeconds: clampInt(row.idle_timeout_seconds, LIMITS.minIdleSeconds, LIMITS.maxIdleSeconds, defaults.idleTimeoutSeconds),
    autoplayDefault: row.autoplay_default === 1,
    defaultLoop: parseLoopMode(row.default_loop),
    allowFilters: row.allow_filters !== 0,
    requestChannelId: nullableId(row.request_channel_id),
    requestMessagesEnabled: row.request_messages_enabled === 1,
    controllerChannelId: nullableId(row.controller_channel_id),
    controllerMessageId: nullableId(row.controller_message_id),
  };
}

/** Column mapping shared by the repository and its tests. */
export const SETTINGS_COLUMNS: Record<keyof Omit<GuildSettings, 'guildId'>, string> = {
  djRoleId: 'dj_role_id',
  defaultVolume: 'default_volume',
  maxVolume: 'max_volume',
  idleTimeoutSeconds: 'idle_timeout_seconds',
  autoplayDefault: 'autoplay_default',
  defaultLoop: 'default_loop',
  allowFilters: 'allow_filters',
  requestChannelId: 'request_channel_id',
  requestMessagesEnabled: 'request_messages_enabled',
  controllerChannelId: 'controller_channel_id',
  controllerMessageId: 'controller_message_id',
};

export function toColumnValue(value: string | number | boolean | null): string | number | null {
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}
