export interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
  /** Zero based index of the first item on this page. */
  startIndex: number;
  total: number;
}

/** Slices a list into a page. Out-of-range page numbers are clamped instead of throwing. */
export function paginate<T>(items: readonly T[], page: number, perPage: number): Page<T> {
  const size = Math.max(1, Math.floor(perPage));
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const safePage = Math.min(totalPages, Math.max(1, Math.floor(Number.isFinite(page) ? page : 1)));
  const startIndex = (safePage - 1) * size;
  return {
    items: items.slice(startIndex, startIndex + size),
    page: safePage,
    totalPages,
    startIndex,
    total: items.length,
  };
}

/**
 * Splits long text into chunks no longer than `maxLength`, preferring line breaks
 * so lyrics are never cut in the middle of a line.
 */
export function chunkText(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    if (current.trim()) chunks.push(current.trimEnd());
    current = '';
  };

  for (const line of text.split('\n')) {
    let remaining = line;
    while (remaining.length > maxLength) {
      flush();
      chunks.push(remaining.slice(0, maxLength));
      remaining = remaining.slice(maxLength);
    }
    if (current.length + remaining.length + 1 > maxLength) flush();
    current += `${remaining}\n`;
  }
  flush();
  return chunks;
}
