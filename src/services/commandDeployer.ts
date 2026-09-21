import { createHash } from 'node:crypto';
import { REST, Routes, type RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import type { DatabaseSync } from 'node:sqlite';
import type { Env } from '../config/env.js';
import { commands } from '../commands/index.js';
import { logger } from '../utils/logger.js';

const HASH_KEY = 'commands_hash';

export function commandPayload(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  return commands.map((command) => command.data.toJSON());
}

function readMeta(db: DatabaseSync, key: string): string | undefined {
  const row = db.prepare('SELECT value FROM bot_meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

function writeMeta(db: DatabaseSync, key: string, value: string): void {
  db.prepare('INSERT INTO bot_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

/**
 * Registers slash commands with Discord. Global when DISCORD_GUILD_ID is empty, otherwise for that
 * one guild (instant updates, ideal while developing).
 */
export async function deployCommands(env: Env): Promise<number> {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  const body = commandPayload();
  const route = env.DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID)
    : Routes.applicationCommands(env.DISCORD_CLIENT_ID);
  await rest.put(route, { body });
  return body.length;
}

/**
 * Deploys only when the command definitions changed since the last successful deploy.
 * Discord limits how often commands may be re-registered, so unchanged restarts must not call the API.
 */
export async function deployCommandsIfChanged(env: Env, db: DatabaseSync): Promise<void> {
  const scope = env.DISCORD_GUILD_ID ? `guild:${env.DISCORD_GUILD_ID}` : 'global';
  const hash = createHash('sha256').update(scope).update(JSON.stringify(commandPayload())).digest('hex');
  if (readMeta(db, HASH_KEY) === hash) {
    logger.debug('Slash commands are up to date');
    return;
  }
  const count = await deployCommands(env);
  writeMeta(db, HASH_KEY, hash);
  logger.info({ count, scope }, 'Registered slash commands with Discord');
}
