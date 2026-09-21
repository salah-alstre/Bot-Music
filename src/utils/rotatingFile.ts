import fs from 'node:fs';
import path from 'node:path';

export interface RotatingFileOptions {
  filePath: string;
  maxBytes: number;
  maxFiles: number;
  /** Applied to every chunk before it is written, used to strip secrets. */
  transform?: (chunk: string) => string;
}

/**
 * Minimal size-based rotating log writer (bot.log -> bot.1.log -> bot.2.log ...).
 * Writes are synchronous so the last lines before a crash are never lost, and the
 * writer never throws: a failing disk must not take the bot down.
 */
export class RotatingFileStream {
  private fd: number | null = null;
  private size = 0;
  private readonly base: string;
  private readonly ext: string;

  constructor(private readonly options: RotatingFileOptions) {
    this.ext = path.extname(options.filePath);
    this.base = options.filePath.slice(0, options.filePath.length - this.ext.length);
    fs.mkdirSync(path.dirname(options.filePath), { recursive: true });
    this.open();
  }

  write(chunk: string): void {
    try {
      const text = this.options.transform ? this.options.transform(chunk) : chunk;
      const bytes = Buffer.byteLength(text);
      if (this.size > 0 && this.size + bytes > this.options.maxBytes) this.rotate();
      if (this.fd === null) this.open();
      if (this.fd === null) return;
      fs.writeSync(this.fd, text);
      this.size += bytes;
    } catch {
      this.close();
    }
  }

  close(): void {
    if (this.fd === null) return;
    try {
      fs.closeSync(this.fd);
    } catch {
      /* already closed */
    }
    this.fd = null;
  }

  private open(): void {
    try {
      this.fd = fs.openSync(this.options.filePath, 'a');
      this.size = fs.fstatSync(this.fd).size;
    } catch {
      this.fd = null;
    }
  }

  private rotate(): void {
    this.close();
    try {
      const { maxFiles } = this.options;
      fs.rmSync(this.numbered(maxFiles), { force: true });
      for (let i = maxFiles - 1; i >= 1; i--) {
        if (fs.existsSync(this.numbered(i))) fs.renameSync(this.numbered(i), this.numbered(i + 1));
      }
      fs.renameSync(this.options.filePath, this.numbered(1));
    } catch {
      // A locked file (for example open in an editor) must not stop logging; keep appending instead.
    }
    this.open();
  }

  private numbered(index: number): string {
    return `${this.base}.${index}${this.ext}`;
  }
}

/** Replaces every known secret in a log line. Empty and very short values are ignored to avoid mangling output. */
export function createScrubber(secrets: readonly string[]): (text: string) => string {
  const values = secrets.filter((s) => s.length >= 8);
  return (text) => values.reduce((acc, secret) => acc.split(secret).join('[REDACTED]'), text);
}
