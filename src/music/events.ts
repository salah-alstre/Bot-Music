import type { Player, Track } from 'lavalink-client';
import type { App } from '../app.js';
import { errorEmbed } from '../components/embeds/common.js';
import { logger } from '../utils/logger.js';
import { titleOf, trackKey, type QueueTrack } from './track.js';

const NOTICE_COOLDOWN_MS = 10_000;
const NODE_ERROR_LOG_INTERVAL_MS = 60_000;

/** Wires Lavalink node and player events into logging, the control panel, idle handling and session cleanup. */
export function registerMusicEvents(app: App): void {
  const { lavalink } = app;
  const lastNotice = new Map<string, number>();
  let lastNodeErrorLog = 0;

  const notify = async (player: Player, text: string) => {
    const now = Date.now();
    if (now - (lastNotice.get(player.guildId) ?? 0) < NOTICE_COOLDOWN_MS) return;
    lastNotice.set(player.guildId, now);

    const channelId = app.sessions.get(player.guildId)?.textChannelId ?? player.textChannelId;
    if (!channelId) return;
    try {
      const channel = app.client.channels.cache.get(channelId);
      if (channel?.isSendable()) await channel.send({ embeds: [errorEmbed(text)] });
    } catch (error) {
      logger.debug({ err: error, guildId: player.guildId }, 'Could not send playback notice');
    }
  };

  // --- Node lifecycle -------------------------------------------------------------------------
  lavalink.nodeManager.on('connect', (node) => {
    lastNodeErrorLog = 0;
    logger.info({ node: node.id, version: node.info?.version.semver, plugins: node.info?.plugins.map((p) => `${p.name}@${p.version}`) }, 'Lavalink connected');
  });
  lavalink.nodeManager.on('disconnect', (node, reason) => {
    logger.warn({ node: node.id, code: reason.code, reason: reason.reason }, 'Lavalink disconnected, reconnecting automatically');
  });
  lavalink.nodeManager.on('reconnecting', (node) => {
    logger.debug({ node: node.id }, 'Reconnecting to Lavalink');
  });
  lavalink.nodeManager.on('error', (node, error) => {
    // While Lavalink boots this fires every retry; log the first and then once per minute.
    const now = Date.now();
    if (now - lastNodeErrorLog < NODE_ERROR_LOG_INTERVAL_MS) return;
    lastNodeErrorLog = now;
    logger.error({ node: node.id, err: error }, 'Lavalink connection error (will keep retrying)');
  });

  // --- Player lifecycle -----------------------------------------------------------------------
  lavalink.on('playerCreate', (player) => {
    app.sessions.getOrCreate(player.guildId, app.settings.get(player.guildId));
    logger.info({ guildId: player.guildId, channelId: player.voiceChannelId }, 'Player created');
  });

  lavalink.on('playerDestroy', (player, reason) => {
    const session = app.sessions.delete(player.guildId);
    lastNotice.delete(player.guildId);
    logger.info({ guildId: player.guildId, reason }, 'Player destroyed');
    void app.panel.finalize(player.guildId, session?.panel ?? null);
  });

  lavalink.on('playerDisconnect', (player, voiceChannelId) => {
    logger.warn({ guildId: player.guildId, voiceChannelId }, 'Player disconnected from voice');
  });
  lavalink.on('playerReconnect', (player, voiceChannelId) => {
    logger.info({ guildId: player.guildId, voiceChannelId }, 'Player reconnected to voice');
  });
  lavalink.on('playerMove', (player, from, to) => {
    logger.info({ guildId: player.guildId, from, to }, 'Player moved voice channel');
    if (!to) void player.destroy('Bot was removed from the voice channel');
  });
  lavalink.on('playerSocketClosed', (player, payload) => {
    logger.warn({ guildId: player.guildId, code: payload.code, reason: payload.reason }, 'Voice websocket closed');
  });

  // --- Playback -------------------------------------------------------------------------------
  lavalink.on('trackStart', (player, track) => {
    app.idle.cancelQueueIdle(player.guildId);
    const session = app.sessions.get(player.guildId);
    if (session && track) app.sessions.rememberForAutoplay(session, trackKey(track));
    app.panel.request(player.guildId);
  });

  lavalink.on('trackEnd', (player) => {
    app.panel.request(player.guildId);
  });

  lavalink.on('queueEnd', (player) => {
    app.idle.scheduleQueueIdle(player);
    app.panel.request(player.guildId);
  });

  const skipNotice = (player: Player, track: QueueTrack | Track | null) =>
    notify(player, track ? `I couldn't play **${titleOf(track)}**, so I skipped it.` : "I couldn't play that track, so I skipped it.");

  lavalink.on('trackError', (player, track, payload) => {
    logger.warn({ guildId: player.guildId, title: track ? titleOf(track) : undefined, cause: payload.exception?.message, severity: payload.exception?.severity }, 'Track failed to play');
    void skipNotice(player, track);
  });
  lavalink.on('trackStuck', (player, track, payload) => {
    logger.warn({ guildId: player.guildId, thresholdMs: payload.thresholdMs }, 'Track got stuck');
    void skipNotice(player, track);
  });
}
