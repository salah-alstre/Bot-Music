import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createScrubber, RotatingFileStream } from '../src/utils/rotatingFile.js';

const dirs: string[] = [];
const tmp = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sonaris-log-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('RotatingFileStream', () => {
  it('rotates by size and keeps a bounded number of files', () => {
    const dir = tmp();
    const file = path.join(dir, 'bot.log');
    const stream = new RotatingFileStream({ filePath: file, maxBytes: 100, maxFiles: 2 });
    for (let i = 0; i < 20; i++) stream.write(`${String(i).padStart(2, '0')}${'x'.repeat(48)}\n`);
    stream.close();

    const files = fs.readdirSync(dir).sort();
    expect(files).toEqual(['bot.1.log', 'bot.2.log', 'bot.log']);
    for (const name of files) expect(fs.statSync(path.join(dir, name)).size).toBeLessThanOrEqual(100);
    expect(fs.readFileSync(file, 'utf8')).toContain('19');
  });

  it('creates missing directories and appends to existing files', () => {
    const file = path.join(tmp(), 'nested', 'logs', 'error.log');
    const first = new RotatingFileStream({ filePath: file, maxBytes: 1000, maxFiles: 2 });
    first.write('one\n');
    first.close();
    const second = new RotatingFileStream({ filePath: file, maxBytes: 1000, maxFiles: 2 });
    second.write('two\n');
    second.close();
    expect(fs.readFileSync(file, 'utf8')).toBe('one\ntwo\n');
  });

  it('applies the transform before writing', () => {
    const file = path.join(tmp(), 'bot.log');
    const stream = new RotatingFileStream({ filePath: file, maxBytes: 1000, maxFiles: 2, transform: createScrubber(['super-secret-token']) });
    stream.write('token=super-secret-token\n');
    stream.close();
    expect(fs.readFileSync(file, 'utf8')).toBe('token=[REDACTED]\n');
  });
});

describe('createScrubber', () => {
  it('replaces every occurrence and ignores tiny secrets', () => {
    const scrub = createScrubber(['abcdefgh12345', 'x']);
    expect(scrub('a abcdefgh12345 b abcdefgh12345 x')).toBe('a [REDACTED] b [REDACTED] x');
  });
});
