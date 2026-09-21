import { Client, Collection, GatewayIntentBits, Options } from 'discord.js';
import type { DatabaseSync } from 'node:sqlite';
import type { LavalinkManager } from 'lavalink-client';
import type { Env } from './config/env.js';
import { SettingsStore } from './database/settingsStore.js';
import { IdleManager } from './music/idle.js';
import { createLavalinkManager } from './music/manager.js';
import { PanelService } from './music/panel.js';
import { SessionStore } from './music/session.js';
import type { SlashCommand } from './types/index.js';

/** Composition root: every long-lived service lives here and is passed explicitly, never imported as a global. */
export class App {
  readonly client: Client;
  readonly commands = new Collection<string, SlashCommand>();
  readonly settings: SettingsStore;
  readonly sessions = new SessionStore();
  readonly lavalink: LavalinkManager;
  readonly panel: PanelService;
  readonly idle: IdleManager;
  readonly startedAt = Date.now();

  constructor(
    readonly env: Env,
    readonly db: DatabaseSync,
  ) {
    const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates];
    // MessageContent is a privileged intent, so it is only requested when the host explicitly opts in.
    if (env.MESSAGE_REQUESTS_ENABLED) intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);

    this.client = new Client({
      intents,
      makeCache: Options.cacheWithLimits({
        ...Options.DefaultMakeCacheSettings,
        MessageManager: 0,
        ReactionManager: 0,
        PresenceManager: 0,
        ThreadManager: 0,
      }),
    });

    this.settings = new SettingsStore(db);
    this.panel = new PanelService(this);
    this.idle = new IdleManager(this);
    this.lavalink = createLavalinkManager(this);
  }
}
