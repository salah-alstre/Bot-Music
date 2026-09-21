import type { Player } from 'lavalink-client';
import type { App } from '../app.js';
import { logger } from '../utils/logger.js';
import { humansIn } from './guards.js';

/**
 * Idle handling: leave when the queue has been empty, or the channel has been empty of humans,
 * for the configured time. Timers live on the session so destroying a player always clears them.
 */
export class IdleManager {
  constructor(private readonly app: App) {}

  scheduleQueueIdle(player: Player): void {
    const session = this.app.sessions.get(player.guildId);
    if (!session) return;
    this.clear(session, 'idleTimer');
    const ms = this.app.settings.get(player.guildId).idleTimeoutSeconds * 1000;
    session.idleTimer = setTimeout(() => this.disconnect(player.guildId, 'queue idle timeout'), ms);
  }

  cancelQueueIdle(guildId: string): void {
    const session = this.app.sessions.get(guildId);
    if (session) this.clear(session, 'idleTimer');
  }

  /** Re-evaluates the listener count after any voice state change in the bot's channel. */
  checkAlone(guildId: string): void {
    const player = this.app.lavalink.getPlayer(guildId);
    const session = this.app.sessions.get(guildId);
    if (!player || !session || !player.voiceChannelId) return;

    const channel = this.app.client.guilds.cache.get(guildId)?.channels.cache.get(player.voiceChannelId);
    if (!channel?.isVoiceBased()) return;

    if (humansIn(channel) > 0) {
      this.clear(session, 'aloneTimer');
      return;
    }
    if (session.aloneTimer) return;
    const ms = this.app.settings.get(guildId).idleTimeoutSeconds * 1000;
    session.aloneTimer = setTimeout(() => this.disconnect(guildId, 'alone in voice channel'), ms);
  }

  private clear(session: { idleTimer: NodeJS.Timeout | null; aloneTimer: NodeJS.Timeout | null }, key: 'idleTimer' | 'aloneTimer'): void {
    const timer = session[key];
    if (timer) clearTimeout(timer);
    session[key] = null;
  }

  private disconnect(guildId: string, reason: string): void {
    const player = this.app.lavalink.getPlayer(guildId);
    if (!player) return;
    logger.info({ guildId, reason }, 'Disconnecting idle player');
    void player.destroy(reason).catch((error: unknown) => logger.warn({ err: error, guildId }, 'Failed to destroy idle player'));
  }
}
