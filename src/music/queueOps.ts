/** Pure helpers for queue arithmetic, kept free of Lavalink types so they are trivially testable. */

/** Converts a 1-based user index (as shown in /queue) to a validated 0-based index. */
export function toZeroBased(position: number, length: number): number | null {
  if (!Number.isInteger(position) || position < 1 || position > length) return null;
  return position - 1;
}

export interface MoveResult<T> {
  items: T[];
  moved: T;
}

/** Moves one item from `from` to `to` (both 0-based) without mutating the input. */
export function moveItem<T>(items: readonly T[], from: number, to: number): MoveResult<T> | null {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return null;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return null;
  next.splice(to, 0, moved);
  return { items: next, moved };
}

/** Inclusive 1-based range validation used by /remove. Returns 0-based start and count. */
export function resolveRemovalRange(start: number, end: number | null, length: number): { index: number; count: number } | null {
  const first = toZeroBased(start, length);
  if (first === null) return null;
  const last = end === null ? first : toZeroBased(end, length);
  if (last === null || last < first) return null;
  return { index: first, count: last - first + 1 };
}

export function sumDurations(durations: readonly number[]): number {
  return durations.reduce((total, ms) => total + (Number.isFinite(ms) && ms > 0 ? ms : 0), 0);
}

/** Cycles loop mode in the order users expect from a single button: off -> track -> queue -> off. */
export function nextLoopMode<T extends 'off' | 'track' | 'queue'>(mode: T): 'off' | 'track' | 'queue' {
  if (mode === 'off') return 'track';
  if (mode === 'track') return 'queue';
  return 'off';
}

export function clampVolume(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.round(value)));
}
