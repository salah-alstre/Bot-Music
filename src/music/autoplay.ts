import type { Player, Track, UnresolvedTrack } from 'lavalink-client';
import type { App } from '../app.js';
import { logger } from '../utils/logger.js';
import { artistOf, durationOf, titleOf, trackKey, type Requester } from './track.js';

const MAX_AUTOPLAY_LENGTH_MS = 12 * 60_000;
const MIN_AUTOPLAY_LENGTH_MS = 45_000;

/** Tracks that would feel wrong as an automatic pick: streams, very short clips and marathon mixes. */
export function isAutoplayCandidate(track: Track): boolean {
  if (track.info.isStream) return false;
  const length = durationOf(track);
  return length >= MIN_AUTOPLAY_LENGTH_MS && length <= MAX_AUTOPLAY_LENGTH_MS;
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[([{][^)\]}]*[)\]}]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Picks a random entry from the first `poolSize` items, so results stay relevant but varied. */
export function pickFromPool<T>(items: readonly T[], poolSize = 5, random: () => number = Math.random): T | undefined {
  const pool = items.slice(0, poolSize);
  return pool[Math.floor(random() * pool.length)];
}

/** Search results can be unresolved placeholders; autoplay only wants playable tracks. */
const resolvedOnly = (tracks: readonly (Track | UnresolvedTrack)[]): Track[] => tracks.filter((t): t is Track => !('resolve' in t));

export function createAutoplay(app: App) {
  const botRequester = (): Requester => ({
    id: app.client.user?.id ?? '0',
    username: 'Autoplay',
    avatarUrl: app.client.user?.displayAvatarURL({ extension: 'png', size: 64 }) ?? null,
  });

  return async (player: Player, lastTrack: Track | null): Promise<void> => {
    const session = app.sessions.get(player.guildId);
    if (!session?.autoplay || !lastTrack) return;

    const seen = new Set(session.autoplayHistory);
    const seenTitles = new Set([...seen].map(normalizeTitle));
    seen.add(trackKey(lastTrack));
    seenTitles.add(normalizeTitle(titleOf(lastTrack)));
    const inQueue = new Set(player.queue.tracks.map((t) => t.info.identifier));

    const isFresh = (track: Track) =>
      isAutoplayCandidate(track) &&
      !seen.has(trackKey(track)) &&
      !inQueue.has(track.info.identifier) &&
      !seenTitles.has(normalizeTitle(titleOf(track)));

    const requester = botRequester();
    const candidates: Track[] = [];

    try {
      if (lastTrack.info.sourceName === 'youtube' && lastTrack.info.identifier) {
        const id = lastTrack.info.identifier;
        const mix = await player.search({ query: `https://www.youtube.com/watch?v=${id}&list=RD${id}` }, requester);
        if (mix.loadType === 'playlist' || mix.loadType === 'search') candidates.push(...resolvedOnly(mix.tracks).filter(isFresh));
      }

      if (candidates.length === 0) {
        const artist = artistOf(lastTrack);
        const related = await player.search({ query: `${artist} ${titleOf(lastTrack)}`, source: app.env.DEFAULT_SEARCH_SOURCE }, requester);
        if (related.loadType === 'search') candidates.push(...resolvedOnly(related.tracks).filter(isFresh));
      }
    } catch (error) {
      logger.warn({ err: error, guildId: player.guildId }, 'Autoplay lookup failed');
      return;
    }

    const next = pickFromPool(candidates);
    if (!next) {
      logger.debug({ guildId: player.guildId }, 'Autoplay found no suitable track');
      return;
    }

    app.sessions.rememberForAutoplay(session, trackKey(lastTrack));
    await player.queue.add(next);
  };
}
