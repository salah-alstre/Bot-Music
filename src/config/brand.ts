import { readFileSync } from 'node:fs';

const packageJsonUrl = new URL('../../package.json', import.meta.url);

function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(packageJsonUrl, 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Version of an installed dependency, read from node_modules so /about never drifts from package.json. */
export function dependencyVersion(name: string): string {
  try {
    const url = new URL(`../../node_modules/${name}/package.json`, import.meta.url);
    const pkg = JSON.parse(readFileSync(url, 'utf8')) as { version?: string };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export const BRAND = {
  name: 'Sonaris',
  tagline: 'Precision audio for every server.',
  description:
    'Sonaris is a high-fidelity Discord music bot with YouTube, SoundCloud and Spotify support, a live control panel, audio filters, autoplay and per-server settings.',
  version: readVersion(),
  footer: 'Sonaris',
} as const;

/** Brand palette. Embed colors are numeric because discord.js expects them that way. */
export const COLORS = {
  primary: 0x7c5cff,
  accent: 0x22d3ee,
  success: 0x34d399,
  warning: 0xfbbf24,
  danger: 0xf87171,
  neutral: 0x2b2d3a,
} as const;

/** One consistent icon set so every embed and button speaks the same visual language. */
export const ICONS = {
  play: '▶️',
  pause: '⏸️',
  skip: '⏭️',
  previous: '⏮️',
  stop: '⏹️',
  shuffle: '🔀',
  loopOff: '➡️',
  loopTrack: '🔂',
  loopQueue: '🔁',
  volumeDown: '🔉',
  volumeUp: '🔊',
  volumeMute: '🔇',
  autoplay: '♾️',
  queue: '📜',
  filter: '🎛️',
  lyrics: '🎤',
  add: '➕',
  seek: '⏩',
  music: '🎵',
  search: '🔎',
  success: '✅',
  error: '⚠️',
  info: 'ℹ️',
  live: '🔴',
  clock: '⏱️',
  user: '👤',
  disc: '💿',
  settings: '⚙️',
  dj: '🎧',
  ping: '🏓',
} as const;

export const SOURCE_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  youtubemusic: 'YouTube Music',
  soundcloud: 'SoundCloud',
  spotify: 'Spotify',
  bandcamp: 'Bandcamp',
  twitch: 'Twitch',
  vimeo: 'Vimeo',
  http: 'Direct URL',
  local: 'Local file',
};

export const LIMITS = {
  maxQueueSize: 1000,
  maxPlaylistTracks: 500,
  searchResults: 10,
  searchTimeoutMs: 60_000,
  queuePageSize: 10,
  helpTimeoutMs: 120_000,
  minVolume: 0,
  volumeStep: 10,
  absoluteMaxVolume: 200,
  defaultVolume: 80,
  defaultMaxVolume: 150,
  defaultIdleSeconds: 180,
  minIdleSeconds: 30,
  maxIdleSeconds: 3600,
  panelMinIntervalMs: 1500,
  panelRefreshMs: 30_000,
  lyricsPageSize: 3800,
  autoplayHistorySize: 50,
  previousTracksKept: 25,
} as const;
