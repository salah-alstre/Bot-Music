import type { PlaylistInfo, SearchResult, Track } from 'lavalink-client';
import type { App } from '../app.js';
import { LIMITS } from '../config/brand.js';
import { UserError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { classifyQuery, type QuerySource } from '../utils/sourceDetect.js';
import type { Requester } from './track.js';

export interface SearchOutcome {
  kind: 'track' | 'playlist' | 'search';
  tracks: Track[];
  playlist: PlaylistInfo | null;
}

const LINK_SOURCE_NEEDS: Partial<Record<QuerySource, { manager: string; label: string }>> = {
  spotify: { manager: 'spotify', label: 'Spotify' },
  bandcamp: { manager: 'bandcamp', label: 'Bandcamp' },
  soundcloud: { manager: 'soundcloud', label: 'SoundCloud' },
  twitch: { manager: 'twitch', label: 'Twitch' },
  vimeo: { manager: 'vimeo', label: 'Vimeo' },
};

function pickNode(app: App) {
  const node = app.lavalink.nodeManager.leastUsedNodes()[0];
  if (!node) throw new UserError('The music backend is unavailable right now. Please try again in a few moments.');
  return node;
}

function describeLoadFailure(result: SearchResult, source: QuerySource | null): string {
  const message = result.exception?.message ?? '';
  if (/age|sign in|confirm you|bot|login/i.test(message)) return 'YouTube refused this track (it may be age-restricted or require sign-in).';
  if (/unavailable|private|removed|deleted|not available|blocked/i.test(message)) return 'That track or playlist is unavailable (it may be private, removed or region-locked).';
  if (source === 'spotify') return "I couldn't load that Spotify link. It may be private, unavailable in my region, or the link is invalid.";
  return "I couldn't load that link. It may be unavailable or unsupported.";
}

/**
 * Resolves user input (link or text) into tracks. All validation, source availability checks
 * and error translation live here so commands only deal with friendly `UserError`s.
 */
export async function resolveQuery(app: App, input: string, requester: Requester, options: { limit?: number } = {}): Promise<SearchOutcome> {
  const classified = classifyQuery(input);

  if (classified.type === 'invalid') {
    const reasons = {
      malformed: "That doesn't look like a valid link.",
      protocol: 'Only http and https links are supported.',
      'private-host': "I can't load links that point to local or private network addresses.",
    } as const;
    throw new UserError(reasons[classified.reason]);
  }
  if (classified.type === 'unsupported') {
    throw new UserError(`\`${classified.host}\` isn't a supported source. I can play YouTube, SoundCloud, Spotify, Bandcamp, Twitch, Vimeo and direct audio links.`);
  }

  const node = pickNode(app);

  if (classified.type === 'link') {
    const need = LINK_SOURCE_NEEDS[classified.source];
    if (need && !node.info?.sourceManagers.includes(need.manager)) {
      throw new UserError(`${need.label} links aren't enabled on this bot. The host needs to configure ${need.label} in Lavalink.`);
    }
    let result: SearchResult;
    try {
      result = await node.search({ query: classified.url }, requester);
    } catch (error) {
      logger.warn({ err: error, source: classified.source }, 'Link lookup failed');
      throw new UserError("I couldn't load that link right now. Please try again in a moment.");
    }
    if (result.loadType === 'error') throw new UserError(describeLoadFailure(result, classified.source));
    if (result.loadType === 'empty' || result.tracks.length === 0) throw new UserError("I couldn't find anything playable at that link.");
    if (result.loadType === 'playlist') return { kind: 'playlist', tracks: result.tracks.slice(0, LIMITS.maxPlaylistTracks), playlist: result.playlist };
    if (result.loadType === 'track') return { kind: 'track', tracks: result.tracks.slice(0, 1), playlist: null };
    return { kind: 'search', tracks: result.tracks.slice(0, options.limit ?? LIMITS.searchResults), playlist: null };
  }

  const sources = [...new Set([app.env.DEFAULT_SEARCH_SOURCE, 'ytsearch', 'scsearch'] as const)];
  let failureSeen = false;
  for (const source of sources) {
    try {
      const result = await node.search({ query: classified.query, source }, requester);
      if (result.loadType === 'error') {
        failureSeen = true;
        logger.debug({ source, message: result.exception?.message }, 'Search source returned an error');
        continue;
      }
      if (result.tracks.length > 0) {
        return { kind: 'search', tracks: result.tracks.slice(0, options.limit ?? LIMITS.searchResults), playlist: null };
      }
    } catch (error) {
      failureSeen = true;
      logger.debug({ err: error, source }, 'Search source failed');
    }
  }

  if (failureSeen) throw new UserError('Search is having trouble right now. Please try again in a moment or paste a direct link.');
  throw new UserError(`No results for **${classified.query.slice(0, 80)}**. Try different keywords or paste a link.`);
}
