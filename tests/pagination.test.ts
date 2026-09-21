import { describe, expect, it } from 'vitest';
import { chunkText, paginate } from '../src/utils/pagination.js';

const items = Array.from({ length: 23 }, (_, i) => i + 1);

describe('paginate', () => {
  it('slices pages', () => {
    const page = paginate(items, 2, 10);
    expect(page.items).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(page).toMatchObject({ page: 2, totalPages: 3, startIndex: 10, total: 23 });
  });
  it('handles the partial last page', () => {
    expect(paginate(items, 3, 10).items).toEqual([21, 22, 23]);
  });
  it('clamps out-of-range pages', () => {
    expect(paginate(items, 99, 10).page).toBe(3);
    expect(paginate(items, -4, 10).page).toBe(1);
    expect(paginate(items, Number.NaN, 10).page).toBe(1);
  });
  it('supports empty lists', () => {
    expect(paginate([], 1, 10)).toMatchObject({ items: [], page: 1, totalPages: 1, total: 0 });
  });
});

describe('chunkText', () => {
  it('never exceeds the limit and keeps every line', () => {
    const text = Array.from({ length: 200 }, (_, i) => `line number ${i}`).join('\n');
    const chunks = chunkText(text, 500);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(500);
    expect(chunks.join('\n')).toContain('line number 199');
    expect(chunks.join('\n')).toContain('line number 0');
  });
  it('splits a single overlong line', () => {
    const chunks = chunkText('x'.repeat(1250), 500);
    expect(chunks.map((c) => c.length)).toEqual([500, 500, 250]);
  });
  it('returns nothing for blank input', () => {
    expect(chunkText('  \n ', 100)).toEqual([]);
  });
});
