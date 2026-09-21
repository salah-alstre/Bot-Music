import type { EmbedBuilder } from 'discord.js';
import type { Player, Track } from 'lavalink-client';
import type { App } from '../app.js';
import { playlistAddedEmbed, trackAddedEmbed } from '../components/embeds/player.js';
import { LIMITS } from '../config/brand.js';
import { UserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { assertCanJoin, humansIn, requireVoiceChannel, type Actor } from './guards.js';
import { sumDurations } from './queueOps.js';
import { resolveQuery, type SearchOutcome } from './search.js';
import { durationOf, requesterFrom } from './track.js';

/**
 * Returns the guild's player, creating and connecting it when needed.
 * Handles the "bot is busy in another channel" case and applies per-guild defaults.
 */
export async function ensurePlayer(app: App, actor: Actor, textChannelId: string | null): Promise<Player> {
  const { guild, member } = actor;
  const voiceChannel = requireVoiceChannel(member);
  const settings = app.settings.get(guild.id);

  let player = app.lavalink.getPlayer(guild.id);

  if (player && player.voiceChannelId && player.voiceChannelId !== voiceChannel.id) {
    const current = guild.channels.cache.get(player.voiceChannelId);
    if (current?.isVoiceBased() && humansIn(current) > 0) {
      throw new UserError(`I'm already playing music in ${current}. Join that channel to add songs.`);
    }
    assertCanJoin(guild, voiceChannel);
    await player.changeVoiceState({ voiceChannelId: voiceChannel.id });
  }

  if (!player) {
    if (!app.lavalink.useable) throw new UserError('The music backend is starting up or unavailable. Please try again in a few moments.');
    assertCanJoin(guild, voiceChannel);
    player = app.lavalink.createPlayer({
      guildId: guild.id,
      voiceChannelId: voiceChannel.id,
      ...(textChannelId ? { textChannelId } : {}),
      selfDeaf: true,
      volume: settings.defaultVolume,
    });
    await player.connect();
    if (settings.defaultLoop !== 'off') await player.setRepeatMode(settings.defaultLoop);
  }

  const session = app.sessions.getOrCreate(guild.id, settings);
  if (textChannelId) session.textChannelId = textChannelId;
  return player;
}

export interface EnqueueResult {
  added: Track[];
  startedNow: boolean;
  /** 0 when the track is playing immediately, otherwise the 1-based queue position of the first added track. */
  position: number;
  etaMs: number | null;
}

export async function enqueueTracks(app: App, player: Player, tracks: Track[], options: { next?: boolean } = {}): Promise<EnqueueResult> {
  const room = LIMITS.maxQueueSize - player.queue.tracks.length;
  if (room <= 0) throw new UserError(`The queue is full (${LIMITS.maxQueueSize} tracks). Remove a few songs first.`);
  const added = tracks.slice(0, room);

  const wasIdle = !player.queue.current;
  const waitBefore = wasIdle
    ? 0
    : Math.max(0, durationOf(player.queue.current as Track) - player.position) + sumDurations(player.queue.tracks.map((t) => (t.info.isStream ? 0 : durationOf(t))));

  if (options.next && !wasIdle) await player.queue.add(added, 0);
  else await player.queue.add(added);

  const position = wasIdle ? 0 : options.next ? 1 : player.queue.tracks.length - added.length + 1;

  if (wasIdle) {
    app.idle.cancelQueueIdle(player.guildId);
    await player.play({ paused: false });
  }
  app.panel.request(player.guildId);

  return { added, startedNow: wasIdle, position, etaMs: wasIdle ? null : options.next ? Math.max(0, durationOf(player.queue.current as Track) - player.position) : waitBefore };
}

export function embedForEnqueue(outcome: SearchOutcome, result: EnqueueResult, player: Player): EmbedBuilder {
  if (outcome.kind === 'playlist' && outcome.playlist) {
    return playlistAddedEmbed(outcome.playlist.title || outcome.playlist.name || 'Playlist', outcome.playlist.uri, result.added, outcome.playlist.thumbnail ?? null);
  }
  const first = result.added[0] as Track;
  return trackAddedEmbed(first, result.position, result.etaMs, player.queue.tracks.length);
}

/** Full /play pipeline shared by the slash command, the request channel and the panel's "Add song" modal. */
export async function playQuery(
  app: App,
  actor: Actor,
  textChannelId: string | null,
  query: string,
  options: { next?: boolean } = {},
): Promise<{ embed: EmbedBuilder; outcome: SearchOutcome; result: EnqueueResult }> {
  requireVoiceChannel(actor.member);
  const requester = requesterFrom(actor.member);
  const outcome = await resolveQuery(app, query, requester);

  const chosen = outcome.kind === 'search' ? outcome.tracks.slice(0, 1) : outcome.tracks;
  const player = await ensurePlayer(app, actor, textChannelId);
  const result = await enqueueTracks(app, player, chosen, options);

  logger.debug({ guildId: actor.guild.id, kind: outcome.kind, count: result.added.length }, 'Tracks enqueued');
  return { embed: embedForEnqueue({ ...outcome, tracks: chosen }, result, player), outcome, result };
}
