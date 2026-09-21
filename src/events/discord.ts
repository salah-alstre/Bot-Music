import { Events, type Message } from 'discord.js';
import type { App } from '../app.js';
import { errorEmbed } from '../components/embeds/common.js';
import { routeInteraction } from '../interactions/router.js';
import { playQuery } from '../music/playback.js';
import { UserError, isIgnorableDiscordError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const REQUEST_COOLDOWN_MS = 3000;
const NOTICE_LIFETIME_MS = 8000;

/** Gateway plumbing: raw voice packets for Lavalink, interactions, voice state and diagnostics. */
export function registerDiscordEvents(app: App): void {
  const { client } = app;

  // Voice server/state updates must reach Lavalink or audio never starts.
  client.on(Events.Raw, (packet) => {
    void app.lavalink.sendRawData(packet).catch((error: unknown) => logger.debug({ err: error }, 'Failed to forward raw packet'));
  });

  client.on(Events.InteractionCreate, (interaction) => {
    void routeInteraction(interaction, app).catch((error: unknown) => {
      if (!isIgnorableDiscordError(error)) logger.error({ err: error }, 'Unhandled interaction error');
    });
  });

  client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    for (const guildId of new Set([oldState.guild.id, newState.guild.id])) {
      if (app.lavalink.getPlayer(guildId)) app.idle.checkAlone(guildId);
    }
  });

  client.on(Events.GuildDelete, (guild) => {
    const player = app.lavalink.getPlayer(guild.id);
    if (player) void player.destroy('Removed from guild');
  });

  client.on(Events.Error, (error) => logger.error({ err: error }, 'Discord client error'));
  client.on(Events.Warn, (message) => logger.warn({ message }, 'Discord client warning'));
  client.on(Events.ShardDisconnect, (event, shardId) => logger.warn({ shardId, code: event.code }, 'Discord shard disconnected'));
  client.on(Events.ShardReconnecting, (shardId) => logger.info({ shardId }, 'Discord shard reconnecting'));
  client.on(Events.ShardResume, (shardId, replayed) => logger.info({ shardId, replayed }, 'Discord shard resumed'));

  if (app.env.MESSAGE_REQUESTS_ENABLED) registerMessageRequests(app);
}

function registerMessageRequests(app: App): void {
  const lastRequest = new Map<string, number>();

  const reply = async (message: Message<true>, text: string) => {
    try {
      const notice = await message.channel.send({ embeds: [errorEmbed(text)] });
      setTimeout(() => void notice.delete().catch(() => undefined), NOTICE_LIFETIME_MS).unref();
    } catch (error) {
      logger.debug({ err: error }, 'Could not send request notice');
    }
  };

  app.client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.inGuild() || !message.member) return;
    const settings = app.settings.get(message.guildId);
    if (!settings.requestMessagesEnabled || message.channelId !== settings.requestChannelId) return;

    const query = message.content.trim();
    if (query.length < 2 || query.length > 300) return;

    // The request channel stays tidy: the message is consumed whether or not the request works.
    void message.delete().catch(() => undefined);

    const now = Date.now();
    if (now - (lastRequest.get(message.author.id) ?? 0) < REQUEST_COOLDOWN_MS) return;
    lastRequest.set(message.author.id, now);
    if (lastRequest.size > 500) lastRequest.clear();

    try {
      await playQuery(app, { guild: message.guild, member: message.member }, message.channelId, query);
    } catch (error) {
      if (error instanceof UserError) await reply(message, error.message);
      else {
        logger.error({ err: error, guildId: message.guildId }, 'Message request failed');
        await reply(message, 'Something went wrong while handling that request.');
      }
    }
  });
}
