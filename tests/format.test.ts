import { describe, expect, it } from 'vitest';
import { escapeMarkdown, formatDuration, formatTrackLength, formatUptime, parseTimeInput, pluralize, progressBar, truncate } from '../src/utils/format.js';

describe('formatDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5_000)).toBe('0:05');
    expect(formatDuration(134_000)).toBe('2:14');
    expect(formatDuration(222_999)).toBe('3:42');
  });
  it('adds hours when needed', () => {
    expect(formatDuration(3_600_000)).toBe('1:00:00');
    expect(formatDuration(3_723_000)).toBe('1:02:03');
  });
  it('is safe for invalid input', () => {
    expect(formatDuration(-5)).toBe('0:00');
    expect(formatDuration(Number.NaN)).toBe('0:00');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0:00');
  });
  it('labels live streams', () => {
    expect(formatTrackLength(0, true)).toContain('LIVE');
    expect(formatTrackLength(65_000, false)).toBe('1:05');
    expect(formatTrackLength(65_000, undefined)).toBe('1:05');
  });
});

describe('formatUptime', () => {
  it('shows the relevant units', () => {
    expect(formatUptime(42_000)).toBe('42s');
    expect(formatUptime(3_660_000)).toBe('1h 1m');
    expect(formatUptime(90_061_000)).toBe('1d 1h 1m');
  });
});

describe('progressBar', () => {
  it('places the marker proportionally', () => {
    expect(progressBar(0, 100, 10)).toBe('●━━━━━━━━━');
    expect(progressBar(100, 100, 10)).toBe('━━━━━━━━━●');
    expect(progressBar(50, 100, 11)).toBe('━━━━━●━━━━━');
  });
  it('always has the requested width', () => {
    for (const pos of [-10, 0, 33, 100, 500]) expect([...progressBar(pos, 100, 18)]).toHaveLength(18);
  });
  it('handles unknown durations', () => {
    expect(progressBar(10, 0, 8)).toBe('━━━━━━━●');
    expect(progressBar(10, Number.NaN, 8)).toBe('━━━━━━━●');
  });
});

describe('text helpers', () => {
  it('truncates with an ellipsis', () => {
    expect(truncate('hello', 10)).toBe('hello');
    expect(truncate('hello world', 6)).toBe('hello…');
    expect(truncate('abc', 1)).toBe('a');
  });
  it('pluralizes', () => {
    expect(pluralize(1, 'track')).toBe('1 track');
    expect(pluralize(1200, 'track')).toBe('1,200 tracks');
  });
  it('escapes markdown that could break links', () => {
    expect(escapeMarkdown('[a](b) *x*')).toBe('\\[a\\]\\(b\\) \\*x\\*');
  });
});

describe('parseTimeInput', () => {
  it('parses clock, seconds and unit formats', () => {
    expect(parseTimeInput('1:30')).toEqual({ ms: 90_000, relative: false });
    expect(parseTimeInput('1:02:03')).toEqual({ ms: 3_723_000, relative: false });
    expect(parseTimeInput('90')).toEqual({ ms: 90_000, relative: false });
    expect(parseTimeInput('1m30s')).toEqual({ ms: 90_000, relative: false });
    expect(parseTimeInput('2h')).toEqual({ ms: 7_200_000, relative: false });
  });
  it('supports relative offsets', () => {
    expect(parseTimeInput('+30')).toEqual({ ms: 30_000, relative: true });
    expect(parseTimeInput('-15')).toEqual({ ms: -15_000, relative: true });
  });
  it('rejects nonsense', () => {
    for (const bad of ['', 'abc', '1:2:3:4', '::', 'm', '1x']) expect(parseTimeInput(bad)).toBeNull();
  });
});
