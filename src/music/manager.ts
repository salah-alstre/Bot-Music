import { LavalinkManager } from 'lavalink-client';
import type { App } from '../app.js';
import { BRAND, LIMITS } from '../config/brand.js';
import { createAutoplay } from './autoplay.js';

export function createLavalinkManager(app: App): LavalinkManager {
  const { env } = app;

  return new LavalinkManager({
    nodes: [
      {
        id: 'main',
        host: env.LAVALINK_HOST,
        port: env.LAVALINK_PORT,
        authorization: env.LAVALINK_PASSWORD,
        secure: env.LAVALINK_SECURE,
        // Lavalink takes several seconds to boot, so the client must keep knocking instead of giving up.
        // retryTimespan makes the library count only recent attempts, which means the limit is never reached.
        retryAmount: 10,
        retryDelay: 5_000,
        retryTimespan: 30_000,
        requestSignalTimeoutMS: 15_000,
        heartBeatInterval: 30_000,
        enablePingOnStatsCheck: true,
      },
    ],
    sendToShard: (guildId, payload) => app.client.guilds.cache.get(guildId)?.shard.send(payload),
    client: { id: env.DISCORD_CLIENT_ID, username: BRAND.name },
    autoSkip: true,
    autoSkipOnResolveError: true,
    playerOptions: {
      defaultSearchPlatform: env.DEFAULT_SEARCH_SOURCE,
      requesterTransformer: (requester) => requester,
      useUnresolvedData: true,
      minAutoPlayMs: 5_000,
      maxErrorsPerTime: { threshold: 30_000, maxAmount: 5 },
      onDisconnect: { autoReconnect: true, autoReconnectOnlyWithTracks: true },
      onEmptyQueue: { autoPlayFunction: createAutoplay(app) },
    },
    queueOptions: { maxPreviousTracks: LIMITS.previousTracksKept },
  });
}
