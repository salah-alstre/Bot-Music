import { REST, Routes } from 'discord.js';
import { loadEnv } from '../config/env.js';
import { deployCommands } from '../services/commandDeployer.js';

/**
 * Registers slash commands now instead of waiting for the next bot start.
 *   npm run deploy:commands                  register (globally, or for DISCORD_GUILD_ID when it is set)
 *   npm run deploy:commands -- --clear-guild remove the commands registered for DISCORD_GUILD_ID
 */
try {
  const env = loadEnv();

  if (process.argv.includes('--clear-guild')) {
    if (!env.DISCORD_GUILD_ID) throw new Error('Set DISCORD_GUILD_ID in .env to choose which server to clear.');
    const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
    await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID), { body: [] });
    console.log(`Removed the commands registered for guild ${env.DISCORD_GUILD_ID}.`);
  } else {
    const count = await deployCommands(env);
    console.log(`Registered ${count} slash commands ${env.DISCORD_GUILD_ID ? `for guild ${env.DISCORD_GUILD_ID}` : 'globally'}.`);
    if (!env.DISCORD_GUILD_ID) console.log('Global commands can take up to an hour to appear everywhere.');
  }
} catch (error) {
  console.error('Failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}
