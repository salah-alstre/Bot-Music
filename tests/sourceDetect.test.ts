import { describe, expect, it } from 'vitest';
import { classifyQuery, isPrivateHost } from '../src/utils/sourceDetect.js';

const link = (input: string) => {
  const result = classifyQuery(input);
  return result.type === 'link' ? { source: result.source, kind: result.kind } : result;
};

describe('classifyQuery', () => {
  it('treats plain text as a search', () => {
    expect(classifyQuery('  Arctic Monkeys Do I Wanna Know ')).toEqual({ type: 'search', query: 'Arctic Monkeys Do I Wanna Know' });
  });

  it('detects YouTube tracks and playlists', () => {
    expect(link('https://www.youtube.com/watch?v=pqrUQrAcfo4')).toEqual({ source: 'youtube', kind: 'track' });
    expect(link('https://youtu.be/pqrUQrAcfo4?t=10')).toEqual({ source: 'youtube', kind: 'track' });
    expect(link('https://www.youtube.com/playlist?list=PL123')).toEqual({ source: 'youtube', kind: 'playlist' });
    expect(link('https://www.youtube.com/watch?v=abc&list=PL123')).toEqual({ source: 'youtube', kind: 'track' });
    expect(link('https://m.youtube.com/watch?v=abc')).toEqual({ source: 'youtube', kind: 'track' });
  });

  it('detects YouTube Music', () => {
    expect(link('https://music.youtube.com/watch?v=abc')).toEqual({ source: 'youtubemusic', kind: 'track' });
  });

  it('detects SoundCloud', () => {
    expect(link('https://soundcloud.com/artist/track')).toEqual({ source: 'soundcloud', kind: 'track' });
    expect(link('https://soundcloud.com/artist/sets/mix')).toEqual({ source: 'soundcloud', kind: 'playlist' });
    expect(link('https://on.soundcloud.com/abc')).toEqual({ source: 'soundcloud', kind: 'track' });
  });

  it('detects Spotify links, including regional paths and URIs', () => {
    expect(link('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=1')).toEqual({ source: 'spotify', kind: 'track' });
    expect(link('https://open.spotify.com/intl-de/album/abc')).toEqual({ source: 'spotify', kind: 'album' });
    expect(link('https://open.spotify.com/playlist/abc')).toEqual({ source: 'spotify', kind: 'playlist' });
    expect(link('spotify:track:4cOdK2wGLETKBW3PvgPWqT')).toEqual({ source: 'spotify', kind: 'track' });
  });

  it('detects direct audio files', () => {
    expect(link('https://cdn.example.com/music/song.mp3')).toEqual({ source: 'direct', kind: 'track' });
    expect(link('https://radio.example.com/stream.m3u8')).toEqual({ source: 'direct', kind: 'track' });
  });

  it('rejects unsupported and invalid links', () => {
    expect(classifyQuery('https://example.com/page.html')).toEqual({ type: 'unsupported', host: 'example.com' });
    expect(classifyQuery('ftp://example.com/song.mp3')).toEqual({ type: 'invalid', reason: 'protocol' });
    expect(classifyQuery('file:///etc/passwd')).toEqual({ type: 'invalid', reason: 'protocol' });
    expect(classifyQuery('http://')).toEqual({ type: 'invalid', reason: 'malformed' });
  });

  it('blocks private and loopback targets', () => {
    const urls = ['http://localhost/a.mp3', 'http://127.0.0.1:2333/v4/info', 'http://10.0.0.5/a.mp3', 'http://192.168.1.1/a.mp3', 'http://169.254.169.254/latest', 'http://[::1]/a.mp3'];
    for (const url of urls) expect(classifyQuery(url)).toEqual({ type: 'invalid', reason: 'private-host' });
  });
});

describe('isPrivateHost', () => {
  it('allows public hosts', () => {
    expect(isPrivateHost('youtube.com')).toBe(false);
    expect(isPrivateHost('8.8.8.8')).toBe(false);
    expect(isPrivateHost('172.32.0.1')).toBe(false);
  });
  it('flags private ranges', () => {
    expect(isPrivateHost('172.16.0.1')).toBe(true);
    expect(isPrivateHost('printer.local')).toBe(true);
    expect(isPrivateHost('fd00::1')).toBe(true);
  });
});
