import { ICONS } from '../config/brand.js';

const DAY_MS = 86_400_000;

/** Formats milliseconds as m:ss or h:mm:ss. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}

/** Duration label that understands live streams. */
export function formatTrackLength(ms: number, isStream: boolean | undefined): string {
  return isStream ? `${ICONS.live} LIVE` : formatDuration(ms);
}

/** Human readable uptime such as "2d 3h 4m". */
export function formatUptime(ms: number): string {
  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (days || hours) parts.push(`${hours}h`);
  if (days || hours || minutes) parts.push(`${minutes}m`);
  if (!days && !hours) parts.push(`${seconds}s`);
  return parts.join(' ');
}

/**
 * Builds a progress bar like `━━━━━●━━━━━`.
 * Position is clamped so bad input from a stream or an unseeded track never breaks the layout.
 */
export function progressBar(positionMs: number, durationMs: number, size = 18): string {
  const safeSize = Math.max(3, Math.floor(size));
  if (!Number.isFinite(durationMs) || durationMs <= 0) return '━'.repeat(safeSize - 1) + '●';
  const ratio = Math.min(1, Math.max(0, positionMs / durationMs));
  const marker = Math.min(safeSize - 1, Math.round(ratio * (safeSize - 1)));
  return '━'.repeat(marker) + '●' + '━'.repeat(safeSize - 1 - marker);
}

export function truncate(text: string, max: number): string {
  if (max <= 1) return text.slice(0, max);
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? singular : plural}`;
}

/** Escapes characters that would break Discord markdown or masked links. */
export function escapeMarkdown(text: string): string {
  return text.replace(/([\\*_`~|[\]()>])/g, '\\$1');
}

/**
 * Parses seek input: "90", "1:30", "1:02:03", "1m30s", "+30", "-15".
 * Returns milliseconds and whether the value is relative to the current position.
 */
export function parseTimeInput(input: string): { ms: number; relative: boolean } | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;

  const relative = text.startsWith('+') || text.startsWith('-');
  const sign = text.startsWith('-') ? -1 : 1;
  const body = relative ? text.slice(1).trim() : text;

  let seconds: number | null = null;

  if (/^\d+(\.\d+)?$/.test(body)) {
    seconds = Number(body);
  } else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(body)) {
    const parts = body.split(':').map(Number);
    if (parts.some((p) => Number.isNaN(p))) return null;
    seconds = parts.reduce((acc, part) => acc * 60 + part, 0);
  } else {
    const match = /^(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?$/.exec(body);
    if (match && (match[1] || match[2] || match[3])) {
      seconds = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
    }
  }

  if (seconds === null || !Number.isFinite(seconds)) return null;
  return { ms: Math.round(seconds * 1000) * sign, relative };
}
