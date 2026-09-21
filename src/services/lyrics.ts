import { BRAND } from '../config/brand.js';
import { logger } from '../utils/logger.js';

export interface LyricsResult {
  title: string;
  artist: string;
  text: string;
  provider: string;
}

const TIMEOUT_MS = 8000;

/**
 * Strips the decoration video uploaders add to titles ("(Official Video)", "[Lyrics]", "ft. X")
 * because providers match on the clean song name.
 */
export function cleanTitle(title: string): string {
  return title
    .replace(/[([{](?:[^)\]}]*\b(?:official|lyrics?|lyric video|audio|video|music video|visuali[sz]er|hd|hq|4k|remaster(?:ed)?|explicit|clean|live|mv)\b[^)\]}]*)[)\]}]/gi, '')
    .replace(/\s+(?:ft\.?|feat\.?|featuring)\s+.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function cleanArtist(artist: string): string {
  return artist.replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').replace(/\s*(official)$/i, '').trim();
}

/** Some uploads are titled "Artist - Song"; prefer that split over the channel name. */
export function splitArtistTitle(title: string, author: string): { artist: string; title: string } {
  const match = /^(.{1,60}?)\s+[-–—]\s+(.{1,120})$/.exec(cleanTitle(title));
  if (match?.[1] && match[2]) return { artist: cleanArtist(match[1]), title: cleanTitle(match[2]) };
  return { artist: cleanArtist(author), title: cleanTitle(title) };
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': `${BRAND.name}/${BRAND.version} (Discord music bot)`, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch (error) {
    logger.debug({ err: error, url: url.split('?')[0] }, 'Lyrics request failed');
    return null;
  }
}

interface LrcLibEntry {
  trackName?: string;
  artistName?: string;
  plainLyrics?: string | null;
  instrumental?: boolean;
}

async function fromLrcLib(artist: string, title: string, durationMs: number | undefined): Promise<LyricsResult | null> {
  const exact = new URL('https://lrclib.net/api/get');
  exact.searchParams.set('artist_name', artist);
  exact.searchParams.set('track_name', title);
  if (durationMs && durationMs > 0) exact.searchParams.set('duration', String(Math.round(durationMs / 1000)));

  const direct = await getJson<LrcLibEntry>(exact.toString());
  if (direct?.plainLyrics) {
    return { title: direct.trackName ?? title, artist: direct.artistName ?? artist, text: direct.plainLyrics, provider: 'LRCLIB' };
  }

  const search = new URL('https://lrclib.net/api/search');
  search.searchParams.set('q', `${artist} ${title}`.trim());
  const results = await getJson<LrcLibEntry[]>(search.toString());
  const match = results?.find((entry) => entry.plainLyrics && !entry.instrumental);
  if (!match?.plainLyrics) return null;
  return { title: match.trackName ?? title, artist: match.artistName ?? artist, text: match.plainLyrics, provider: 'LRCLIB' };
}

async function fromLyricsOvh(artist: string, title: string): Promise<LyricsResult | null> {
  if (!artist || !title) return null;
  const data = await getJson<{ lyrics?: string }>(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
  const text = data?.lyrics?.trim();
  return text ? { title, artist, text, provider: 'lyrics.ovh' } : null;
}

/** Looks up lyrics across providers. Returns null instead of throwing when nothing is found. */
export async function findLyrics(rawTitle: string, rawAuthor: string, durationMs?: number): Promise<LyricsResult | null> {
  const { artist, title } = splitArtistTitle(rawTitle, rawAuthor);
  const candidates = [{ artist, title }];
  const fallbackArtist = cleanArtist(rawAuthor);
  if (fallbackArtist && fallbackArtist.toLowerCase() !== artist.toLowerCase()) candidates.push({ artist: fallbackArtist, title: cleanTitle(rawTitle) });

  for (const candidate of candidates) {
    const result = (await fromLrcLib(candidate.artist, candidate.title, durationMs)) ?? (await fromLyricsOvh(candidate.artist, candidate.title));
    if (result) return { ...result, text: result.text.replace(/\r\n/g, '\n').trim() };
  }
  return null;
}
