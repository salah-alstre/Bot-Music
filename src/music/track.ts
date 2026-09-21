import type { Track, UnresolvedTrack } from 'lavalink-client';
import type { GuildMember, User } from 'discord.js';
import { SOURCE_LABELS } from '../config/brand.js';
import { escapeMarkdown, truncate } from '../utils/format.js';

export type QueueTrack = Track | UnresolvedTrack;

export interface Requester {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export function requesterFrom(user: User | GuildMember): Requester {
  const source = 'user' in user ? user.user : user;
  return {
    id: source.id,
    username: 'displayName' in user ? user.displayName : source.username,
    avatarUrl: source.displayAvatarURL({ extension: 'png', size: 64 }),
  };
}

function isRequester(value: unknown): value is Requester {
  return typeof value === 'object' && value !== null && typeof (value as Requester).id === 'string' && typeof (value as Requester).username === 'string';
}

export function requesterOf(track: QueueTrack | null | undefined): Requester | null {
  const candidate = track?.requester as unknown;
  return isRequester(candidate) ? candidate : null;
}

/** YouTube auto-generated channels are named "Artist - Topic"; the suffix is noise in a player UI. */
export function artistOf(track: QueueTrack): string {
  const author = track.info.author?.trim();
  if (!author) return 'Unknown artist';
  return author.replace(/\s*-\s*Topic$/i, '');
}

export function titleOf(track: QueueTrack): string {
  return track.info.title?.trim() || 'Unknown title';
}

/** Title as markdown link when the track has a public URL. */
export function trackLink(track: QueueTrack, maxTitle = 60): string {
  const title = escapeMarkdown(truncate(titleOf(track), maxTitle));
  const uri = track.info.uri;
  return uri && /^https?:\/\//.test(uri) ? `[${title}](${uri})` : title;
}

export function sourceLabelOf(track: QueueTrack): string {
  const name = track.info.sourceName ?? 'unknown';
  const isMusic = name === 'youtube' && /music\.youtube\.com/.test(track.info.uri ?? '');
  return SOURCE_LABELS[isMusic ? 'youtubemusic' : name] ?? name.charAt(0).toUpperCase() + name.slice(1);
}

export function durationOf(track: QueueTrack): number {
  return track.info.duration ?? 0;
}

export function artworkOf(track: QueueTrack | null | undefined): string | null {
  return track?.info.artworkUrl ?? null;
}

/** Stable identity used to avoid repeats in autoplay history. */
export function trackKey(track: QueueTrack): string {
  return track.info.identifier || `${artistOf(track)}::${titleOf(track)}`.toLowerCase();
}
