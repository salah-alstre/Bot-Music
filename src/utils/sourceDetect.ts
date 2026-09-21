import net from 'node:net';

export type QuerySource =
  | 'youtube'
  | 'youtubemusic'
  | 'soundcloud'
  | 'spotify'
  | 'bandcamp'
  | 'twitch'
  | 'vimeo'
  | 'direct';

export type QueryKind = 'track' | 'playlist' | 'album' | 'artist' | 'unknown';

export type QueryClassification =
  | { type: 'search'; query: string }
  | { type: 'link'; source: QuerySource; kind: QueryKind; url: string }
  | { type: 'invalid'; reason: 'malformed' | 'protocol' | 'private-host' }
  | { type: 'unsupported'; host: string };

const AUDIO_EXTENSIONS = /\.(mp3|wav|flac|ogg|oga|opus|m4a|aac|webm|m3u8?|pls)$/i;

const hostMatches = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/** Blocks loopback, private and link-local targets so a user can't make Lavalink fetch internal services. */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return true;
  }
  const family = net.isIP(host);
  if (family === 4) {
    const [a = 0, b = 0] = host.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (family === 6) {
    return (
      host === '::1' ||
      host === '::' ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('fe80') ||
      host.startsWith('::ffff:')
    );
  }
  return false;
}

function classifySpotifyPath(pathname: string): QueryKind {
  const segments = pathname.split('/').filter(Boolean);
  const start = segments[0]?.startsWith('intl-') ? 1 : 0;
  switch (segments[start]) {
    case 'track':
      return 'track';
    case 'album':
      return 'album';
    case 'playlist':
      return 'playlist';
    case 'artist':
      return 'artist';
    default:
      return 'unknown';
  }
}

/**
 * Decides whether user input is a search phrase or a link, and which source a link belongs to.
 * Pure on purpose: routing and validation stay testable without Discord or Lavalink.
 */
export function classifyQuery(input: string): QueryClassification {
  const query = input.trim();

  const spotifyUri = /^spotify:(track|album|playlist|artist):([A-Za-z0-9]+)$/.exec(query);
  if (spotifyUri) {
    const [, kind = 'track', id = ''] = spotifyUri;
    return {
      type: 'link',
      source: 'spotify',
      kind: kind as QueryKind,
      url: `https://open.spotify.com/${kind}/${id}`,
    };
  }

  const looksLikeUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(query) || /^www\./i.test(query);
  if (!looksLikeUrl) return { type: 'search', query };

  let url: URL;
  try {
    url = new URL(/^www\./i.test(query) ? `https://${query}` : query);
  } catch {
    return { type: 'invalid', reason: 'malformed' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { type: 'invalid', reason: 'protocol' };

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (isPrivateHost(host)) return { type: 'invalid', reason: 'private-host' };

  const href = url.toString();

  if (hostMatches(host, 'music.youtube.com')) {
    return { type: 'link', source: 'youtubemusic', kind: url.searchParams.has('list') && !url.searchParams.has('v') ? 'playlist' : 'track', url: href };
  }
  if (hostMatches(host, 'youtube.com') || host === 'youtu.be') {
    const isPlaylist = url.pathname === '/playlist' || (url.searchParams.has('list') && !url.searchParams.has('v') && host !== 'youtu.be');
    return { type: 'link', source: 'youtube', kind: isPlaylist ? 'playlist' : 'track', url: href };
  }
  if (hostMatches(host, 'soundcloud.com') || host === 'snd.sc') {
    const kind: QueryKind = url.pathname.includes('/sets/') ? 'playlist' : 'track';
    return { type: 'link', source: 'soundcloud', kind, url: href };
  }
  if (host === 'open.spotify.com') {
    return { type: 'link', source: 'spotify', kind: classifySpotifyPath(url.pathname), url: href };
  }
  if (hostMatches(host, 'bandcamp.com')) return { type: 'link', source: 'bandcamp', kind: url.pathname.startsWith('/album') ? 'album' : 'track', url: href };
  if (hostMatches(host, 'twitch.tv')) return { type: 'link', source: 'twitch', kind: 'track', url: href };
  if (hostMatches(host, 'vimeo.com')) return { type: 'link', source: 'vimeo', kind: 'track', url: href };
  if (AUDIO_EXTENSIONS.test(url.pathname)) return { type: 'link', source: 'direct', kind: 'track', url: href };

  return { type: 'unsupported', host };
}
