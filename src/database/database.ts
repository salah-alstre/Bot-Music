import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { logger } from '../utils/logger.js';

/** Ordered, append-only migrations. `PRAGMA user_version` tracks how many have been applied. */
const MIGRATIONS: readonly string[] = [
  `CREATE TABLE guild_settings (
    guild_id                 TEXT PRIMARY KEY,
    dj_role_id               TEXT,
    default_volume           INTEGER NOT NULL DEFAULT 80,
    max_volume               INTEGER NOT NULL DEFAULT 150,
    idle_timeout_seconds     INTEGER NOT NULL DEFAULT 180,
    autoplay_default         INTEGER NOT NULL DEFAULT 0,
    default_loop             TEXT    NOT NULL DEFAULT 'off',
    allow_filters            INTEGER NOT NULL DEFAULT 1,
    request_channel_id       TEXT,
    request_messages_enabled INTEGER NOT NULL DEFAULT 0,
    controller_channel_id    TEXT,
    controller_message_id    TEXT,
    updated_at               TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) STRICT`,
  `CREATE TABLE bot_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  ) STRICT`,
];

export function openDatabase(filePath: string): DatabaseSync {
  if (filePath !== ':memory:') mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new DatabaseSync(filePath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

export function migrate(db: DatabaseSync): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number } | undefined;
  const current = row?.user_version ?? 0;

  for (let version = current; version < MIGRATIONS.length; version++) {
    const sql = MIGRATIONS[version];
    if (!sql) continue;
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec('COMMIT');
      logger.info({ version: version + 1 }, 'Applied database migration');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}
