import { App } from './app.js';
import { commands } from './commands/index.js';
import { EnvValidationError, loadEnv, type Env } from './config/env.js';
import { openDatabase } from './database/database.js';
import { registerDiscordEvents } from './events/discord.js';
import { registerReady } from './events/ready.js';
import { registerMusicEvents } from './music/events.js';
import { logger, initLogger } from './utils/logger.js';

const TRANSIENT_LOGIN_ERRORS = /ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|fetch failed|timed? ?out|socket|5\d\d/i;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function loadEnvOrExit(): Env {
  try {
    return loadEnv();
  } catch (error) {
    if (error instanceof EnvValidationError) {
      console.error(`\n${error.message}\n\nFix the values in your .env file (see .env.example) and start the bot again.\n`);
    } else {
      console.error('Failed to read configuration:', error instanceof Error ? error.message : error);
    }
    process.exit(1);
  }
}

/**
 * Logs in to Discord, retrying with backoff while the network is unavailable.
 * After a server reboot the service can start before the network is fully up, so this must not crash.
 */
async function loginWithRetry(app: App): Promise<void> {
  let delay = 5_000;
  for (;;) {
    try {
      await app.client.login(app.env.DISCORD_TOKEN);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = (error as { code?: string } | undefined)?.code ?? '';
      if (!TRANSIENT_LOGIN_ERRORS.test(`${code} ${message}`)) throw error;
      logger.warn({ retryInMs: delay, reason: message }, 'Discord login failed due to a network problem, retrying');
      await wait(delay);
      delay = Math.min(delay * 2, 60_000);
    }
  }
}

async function main(): Promise<void> {
  const env = loadEnvOrExit();
  await initLogger(env);
  logger.info({ node: process.version, env: env.NODE_ENV, lavalink: `${env.LAVALINK_HOST}:${env.LAVALINK_PORT}` }, 'Starting Sonaris');

  let db;
  try {
    db = openDatabase(env.DATABASE_PATH);
  } catch (error) {
    logger.fatal({ err: error, path: env.DATABASE_PATH }, 'Could not open the database');
    process.exit(1);
  }

  const app = new App(env, db);
  for (const command of commands) app.commands.set(command.data.name, command);

  registerMusicEvents(app);
  const presence = registerReady(app);
  registerDiscordEvents(app);

  let shuttingDown = false;
  const shutdown = async (signal: string, exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');
    const force = setTimeout(() => process.exit(exitCode || 1), 10_000);
    force.unref();
    try {
      presence.stop();
      app.panel.stop();
      await Promise.allSettled([...app.lavalink.players.values()].map((player) => player.destroy('Bot shutting down')));
      app.sessions.clear();
      await app.client.destroy();
      db.close();
    } catch (error) {
      logger.error({ err: error }, 'Error during shutdown');
    }
    process.exit(exitCode);
  };

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK'] as const) process.on(signal, () => void shutdown(signal));

  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection');
  });
  // State after an uncaught exception is unknown, so exit and let the Windows service restart a clean process.
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    void shutdown('uncaughtException', 1);
  });

  try {
    await loginWithRetry(app);
  } catch (error) {
    logger.fatal({ err: error }, 'Discord login failed. Check DISCORD_TOKEN and the enabled intents in the Developer Portal.');
    process.exit(1);
  }
}

void main();
