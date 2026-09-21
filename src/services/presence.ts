import { ActivityType, type Client } from 'discord.js';
import type { LavalinkManager } from 'lavalink-client';
import { BRAND } from '../config/brand.js';

const ROTATE_EVERY_MS = 10 * 60_000;

/** Rotates a small set of statuses slowly; Discord throttles presence updates, so there is no live ticker. */
export class PresenceService {
  private timer: NodeJS.Timeout | null = null;
  private step = 0;

  constructor(
    private readonly client: Client,
    private readonly lavalink: LavalinkManager,
  ) {}

  start(): void {
    this.apply();
    this.timer = setInterval(() => this.apply(), ROTATE_EVERY_MS);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private apply(): void {
    const servers = this.client.guilds.cache.size;
    const players = this.lavalink.players.size;
    const lines = [`/play • ${BRAND.name}`, `music in ${servers} ${servers === 1 ? 'server' : 'servers'}`];
    if (players > 0) lines.push(`${players} live ${players === 1 ? 'session' : 'sessions'}`);

    const text = lines[this.step % lines.length] ?? lines[0] ?? '/play';
    this.step += 1;
    this.client.user?.setPresence({ status: 'online', activities: [{ name: text, type: ActivityType.Listening }] });
  }
}
