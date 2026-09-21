import type { GuildSettings } from '../database/settings.js';
import { LIMITS } from '../config/brand.js';

export interface PanelRef {
  channelId: string;
  messageId: string;
}

/** Volatile per-guild state that lives exactly as long as a player. Nothing here is persisted. */
export interface GuildSession {
  guildId: string;
  autoplay: boolean;
  panel: PanelRef | null;
  panelBroken: boolean;
  textChannelId: string | null;
  autoplayHistory: string[];
  idleTimer: NodeJS.Timeout | null;
  aloneTimer: NodeJS.Timeout | null;
}

export class SessionStore {
  private readonly sessions = new Map<string, GuildSession>();

  get(guildId: string): GuildSession | undefined {
    return this.sessions.get(guildId);
  }

  getOrCreate(guildId: string, settings: GuildSettings): GuildSession {
    let session = this.sessions.get(guildId);
    if (!session) {
      session = {
        guildId,
        autoplay: settings.autoplayDefault,
        panel: null,
        panelBroken: false,
        textChannelId: null,
        autoplayHistory: [],
        idleTimer: null,
        aloneTimer: null,
      };
      this.sessions.set(guildId, session);
    }
    return session;
  }

  /** Clears timers so a destroyed player can never leak a pending callback. */
  delete(guildId: string): GuildSession | undefined {
    const session = this.sessions.get(guildId);
    if (!session) return undefined;
    if (session.idleTimer) clearTimeout(session.idleTimer);
    if (session.aloneTimer) clearTimeout(session.aloneTimer);
    this.sessions.delete(guildId);
    return session;
  }

  rememberForAutoplay(session: GuildSession, key: string): void {
    session.autoplayHistory.push(key);
    if (session.autoplayHistory.length > LIMITS.autoplayHistorySize) session.autoplayHistory.shift();
  }

  clear(): void {
    for (const guildId of [...this.sessions.keys()]) this.delete(guildId);
  }
}
