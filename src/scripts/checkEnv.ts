import { EnvValidationError, loadEnv } from '../config/env.js';

/** Validates .env without starting the bot. Used by the Windows setup scripts and `npm run check:env`. */
try {
  const env = loadEnv();
  console.log('  [ OK ] .env is valid');
  console.log(`         Discord application: ${env.DISCORD_CLIENT_ID}`);
  console.log(`         Lavalink:            ${env.LAVALINK_SECURE ? 'https' : 'http'}://${env.LAVALINK_HOST}:${env.LAVALINK_PORT}`);
  console.log(`         Slash commands:      ${env.DISCORD_GUILD_ID ? `guild ${env.DISCORD_GUILD_ID} (development)` : 'global'}`);
  if (env.MESSAGE_REQUESTS_ENABLED) console.log('         Message requests:    enabled (Message Content intent must be on in the Developer Portal)');
  if (!['127.0.0.1', 'localhost', '::1'].includes(env.LAVALINK_HOST)) {
    console.log('  [WARN] LAVALINK_HOST is not local. Lavalink should only be reachable from this machine.');
  }
} catch (error) {
  if (error instanceof EnvValidationError) {
    console.log('  [FAIL] .env has problems:');
    for (const problem of error.problems) console.log(`         - ${problem}`);
  } else {
    console.log('  [FAIL] Could not read .env:', error instanceof Error ? error.message : error);
  }
  process.exit(1);
}
