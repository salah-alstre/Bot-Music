import { ChannelType, RESTJSONErrorCodes, type BaseMessageOptions, type Guild, type GuildTextBasedChannel } from 'discord.js';
import type { App } from '../app.js';
import { buildPanelComponents } from '../components/controls.js';
import { idleEmbed, nowPlayingEmbed } from '../components/embeds/player.js';
import { LIMITS } from '../config/brand.js';
import { isDiscordError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { PanelRef } from './session.js';

interface UpdateState {
  timer: NodeJS.Timeout | null;
  lastRun: number;
  running: boolean;
  dirty: boolean;
}

/**
 * Keeps exactly one control-panel message per guild up to date.
 *
 * Every trigger (track change, pause, loop, volume...) calls `request()`. Updates are coalesced
 * and spaced at least `panelMinIntervalMs` apart, so bursts of changes cost one edit and the bot
 * stays far below Discord's message-edit rate limits.
 */
export class PanelService {
  private readonly states = new Map<string, UpdateState>();
  private ticker: NodeJS.Timeout | null = null;

  constructor(private readonly app: App) {}

  start(): void {
    // Discord renders "<t:...:R>" live in the client, so this slow tick only keeps the progress bar honest.
    this.ticker = setInterval(() => {
      for (const player of this.app.lavalink.players.values()) {
        const tracked = this.app.sessions.get(player.guildId)?.panel ?? this.controllerRef(player.guildId);
        if (tracked && player.playing && !player.paused) this.request(player.guildId);
      }
    }, LIMITS.panelRefreshMs);
    this.ticker.unref();
  }

  stop(): void {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    for (const state of this.states.values()) if (state.timer) clearTimeout(state.timer);
    this.states.clear();
  }

  request(guildId: string, options: { immediate?: boolean } = {}): void {
    const state = this.states.get(guildId) ?? { timer: null, lastRun: 0, running: false, dirty: false };
    this.states.set(guildId, state);

    if (state.running) {
      state.dirty = true;
      return;
    }
    if (state.timer) {
      if (!options.immediate) return;
      clearTimeout(state.timer);
    }

    const wait = options.immediate ? 0 : Math.max(250, LIMITS.panelMinIntervalMs - (Date.now() - state.lastRun));
    state.timer = setTimeout(() => {
      state.timer = null;
      void this.run(guildId, state);
    }, wait);
  }

  render(guildId: string): BaseMessageOptions {
    const player = this.app.lavalink.getPlayer(guildId);
    const session = this.app.sessions.get(guildId);
    const settings = this.app.settings.get(guildId);

    if (player?.queue.current) {
      return { embeds: [nowPlayingEmbed(player, session)], components: buildPanelComponents(player, session, settings) };
    }
    return {
      embeds: [idleEmbed({ messagesEnabled: settings.requestMessagesEnabled && this.app.env.MESSAGE_REQUESTS_ENABLED })],
      components: buildPanelComponents(undefined, undefined, settings),
    };
  }

  /** Called when a player is destroyed: persistent controllers go back to idle, temporary panels are closed. */
  async finalize(guildId: string, panel: PanelRef | null): Promise<void> {
    const state = this.states.get(guildId);
    if (state?.timer) clearTimeout(state.timer);
    this.states.delete(guildId);

    const controller = this.controllerRef(guildId);
    try {
      if (controller) {
        await this.edit(controller, this.render(guildId));
      } else if (panel) {
        await this.edit(panel, { embeds: [idleEmbed({ ended: true })], components: [] });
      }
    } catch (error) {
      if (!isDiscordError(error, RESTJSONErrorCodes.UnknownMessage, RESTJSONErrorCodes.MissingAccess, RESTJSONErrorCodes.MissingPermissions)) {
        logger.warn({ err: error, guildId }, 'Failed to finalize the control panel');
      }
    }
  }

  /** Creates (or replaces) the persistent controller message in a channel and stores its location. */
  async createController(guild: Guild, channel: GuildTextBasedChannel): Promise<void> {
    const previous = this.controllerRef(guild.id);
    if (previous && previous.channelId !== channel.id) await this.deleteMessage(previous);

    const message = await channel.send(this.render(guild.id));
    this.app.settings.update(guild.id, { controllerChannelId: channel.id, controllerMessageId: message.id });
  }

  async removeController(guildId: string): Promise<void> {
    const ref = this.controllerRef(guildId);
    if (ref) await this.deleteMessage(ref);
    this.app.settings.update(guildId, { controllerChannelId: null, controllerMessageId: null });
  }

  /** On startup, players are gone, so every stored controller must be reset to its idle state. */
  async restoreControllers(): Promise<void> {
    for (const { guildId, channelId, messageId } of this.app.settings.controllers()) {
      try {
        await this.edit({ channelId, messageId }, this.render(guildId));
      } catch (error) {
        if (isDiscordError(error, RESTJSONErrorCodes.UnknownMessage, RESTJSONErrorCodes.UnknownChannel)) {
          this.app.settings.update(guildId, { controllerChannelId: null, controllerMessageId: null });
          logger.info({ guildId }, 'Controller message no longer exists, cleared it from settings');
        } else {
          logger.warn({ err: error, guildId }, 'Could not restore controller message');
        }
      }
    }
  }

  private controllerRef(guildId: string): PanelRef | null {
    const { controllerChannelId, controllerMessageId } = this.app.settings.get(guildId);
    return controllerChannelId && controllerMessageId ? { channelId: controllerChannelId, messageId: controllerMessageId } : null;
  }

  private async run(guildId: string, state: UpdateState): Promise<void> {
    state.running = true;
    state.dirty = false;
    try {
      await this.sync(guildId);
    } catch (error) {
      logger.warn({ err: error, guildId }, 'Control panel update failed');
    } finally {
      state.running = false;
      state.lastRun = Date.now();
      if (state.dirty) this.request(guildId);
    }
  }

  private async sync(guildId: string): Promise<void> {
    const session = this.app.sessions.get(guildId);
    const player = this.app.lavalink.getPlayer(guildId);
    const controller = this.controllerRef(guildId);
    if (session?.panelBroken && !controller) return;

    const payload = this.render(guildId);
    const target = controller ?? session?.panel ?? null;

    if (target) {
      try {
        await this.edit(target, payload);
        return;
      } catch (error) {
        if (!isDiscordError(error, RESTJSONErrorCodes.UnknownMessage)) throw this.handlePermissionError(error, guildId, session);
        if (session && !controller) session.panel = null;
        if (controller) this.app.settings.update(guildId, { controllerChannelId: null, controllerMessageId: null });
      }
    }

    if (!player?.queue.current || !session) return;
    const channelId = session.textChannelId ?? player.textChannelId;
    if (!channelId) return;

    try {
      const channel = await this.textChannel(channelId);
      if (!channel) return;
      const message = await channel.send(payload);
      session.panel = { channelId, messageId: message.id };
    } catch (error) {
      throw this.handlePermissionError(error, guildId, session);
    }
  }

  private handlePermissionError(error: unknown, guildId: string, session: { panelBroken: boolean } | undefined): unknown {
    if (isDiscordError(error, RESTJSONErrorCodes.MissingAccess, RESTJSONErrorCodes.MissingPermissions)) {
      if (session) session.panelBroken = true;
      logger.warn({ guildId }, 'Missing permission to post the control panel; disabling it for this session');
    }
    return error;
  }

  private async textChannel(channelId: string): Promise<GuildTextBasedChannel | null> {
    const channel = this.app.client.channels.cache.get(channelId) ?? (await this.app.client.channels.fetch(channelId));
    if (!channel || channel.type === ChannelType.DM || channel.type === ChannelType.GroupDM || !channel.isTextBased()) return null;
    return channel as GuildTextBasedChannel;
  }

  private async edit(ref: PanelRef, payload: BaseMessageOptions): Promise<void> {
    const channel = await this.textChannel(ref.channelId);
    if (!channel) return;
    await channel.messages.edit(ref.messageId, payload);
  }

  private async deleteMessage(ref: PanelRef): Promise<void> {
    try {
      const channel = await this.textChannel(ref.channelId);
      await channel?.messages.delete(ref.messageId);
    } catch {
      /* already gone or not deletable */
    }
  }
}
