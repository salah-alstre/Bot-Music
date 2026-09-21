import { describe, expect, it } from 'vitest';
import { cleanArtist, cleanTitle, splitArtistTitle } from '../src/services/lyrics.js';

describe('cleanTitle', () => {
  it('removes uploader decoration', () => {
    expect(cleanTitle('Do I Wanna Know? (Official Video)')).toBe('Do I Wanna Know?');
    expect(cleanTitle('Song Name [Lyrics] (HD)')).toBe('Song Name');
    expect(cleanTitle('Blinding Lights ft. Someone Else')).toBe('Blinding Lights');
  });
  it('keeps meaningful parentheses', () => {
    expect(cleanTitle("Sweet Child (O' Mine)")).toBe("Sweet Child (O' Mine)");
  });
});

describe('cleanArtist', () => {
  it('strips channel suffixes', () => {
    expect(cleanArtist('Arctic Monkeys - Topic')).toBe('Arctic Monkeys');
    expect(cleanArtist('TheWeekndVEVO')).toBe('TheWeeknd');
  });
});

describe('splitArtistTitle', () => {
  it('prefers "Artist - Title" uploads', () => {
    expect(splitArtistTitle('Queen - Bohemian Rhapsody (Official Video)', 'QueenVEVO')).toEqual({ artist: 'Queen', title: 'Bohemian Rhapsody' });
  });
  it('falls back to the channel name', () => {
    expect(splitArtistTitle('Do I Wanna Know?', 'Arctic Monkeys - Topic')).toEqual({ artist: 'Arctic Monkeys', title: 'Do I Wanna Know?' });
  });
});
