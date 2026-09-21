import { App } from '../app.js';
import { loadEnv } from '../config/env.js';
import { openDatabase } from '../database/database.js';
import { resolveQuery } from '../music/search.js';
import { UserError } from '../utils/errors.js';

/**
 * Checks the whole music backend without needing Discord: connects to Lavalink with the same
 * client settings the bot uses, then resolves a search, a SoundCloud query and a link.
 * Usage: npm run smoke
 */
const env = loadEnv();
const app = new App(env, openDatabase(':memory:'));
const requester = { id: '0', username: 'smoke-test', avatarUrl: null };

const waitForNode = async (timeoutMs: number) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (app.lavalink.useable) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
};

let failures = 0;
const check = async (label: string, run: () => Promise<string>) => {
  try {
    console.log(`  ✔ ${label}: ${await run()}`);
  } catch (error) {
    failures++;
    const message = error instanceof UserError ? error.message : error instanceof Error ? error.message : String(error);
    console.log(`  ✘ ${label}: ${message}`);
  }
};

app.lavalink.nodeManager.on('error', (_node, error) => console.log(`  … waiting for Lavalink (${error.message})`));

console.log(`Connecting to Lavalink at ${env.LAVALINK_HOST}:${env.LAVALINK_PORT} ...`);
await app.lavalink.init({ id: env.DISCORD_CLIENT_ID, username: 'smoke-test' });

if (!(await waitForNode(60_000))) {
  console.error('✘ Could not connect to Lavalink within 60 seconds. Is the MusicBot-Lavalink service running and is LAVALINK_PASSWORD correct?');
  process.exit(1);
}

const node = app.lavalink.nodeManager.leastUsedNodes()[0];
console.log(`✔ Connected. Lavalink ${node?.info?.version.semver}, plugins: ${node?.info?.plugins.map((p) => `${p.name}@${p.version}`).join(', ')}`);
console.log(`  Sources: ${node?.info?.sourceManagers.join(', ')}`);
console.log(`  Filters: ${node?.info?.filters.join(', ')}`);

const first = async (query: string) => {
  const outcome = await resolveQuery(app, query, requester, { limit: 3 });
  const track = outcome.tracks[0];
  return `${outcome.kind}, ${outcome.tracks.length} result(s), first: ${track?.info.title} — ${track?.info.author} [${track?.info.sourceName}]`;
};

console.log('Resolving queries:');
await check('text search', () => first('Arctic Monkeys Do I Wanna Know'));
await check('YouTube link', () => first('https://www.youtube.com/watch?v=pqrUQrAcfo4'));
await check('SoundCloud link', () => first('https://soundcloud.com/teenage-kicks-1/do-i-wanna-know-arctic-monkeys'));
if (node?.info?.sourceManagers.includes('spotify')) {
  await check('Spotify link', () => first('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT'));
} else {
  console.log('  - Spotify: not enabled (set SPOTIFY_ENABLED=true and add credentials to enable it)');
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed. YouTube failures are often temporary; see docs/TROUBLESHOOTING.md.`);
process.exit(failures === 0 ? 0 : 2);
