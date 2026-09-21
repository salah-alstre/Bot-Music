import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

const snowflake = z.string().regex(/^\d{17,20}$/, 'must be a Discord ID (17-20 digits)');
const placeholder = /^(your[-_ ]|changeme|xxx|<|example)/i;

const secret = (name: string, minLength: number) =>
  z
    .string({ error: `${name} is required` })
    .trim()
    .min(minLength, `must be at least ${minLength} characters`)
    .refine((v) => !placeholder.test(v), 'still contains the placeholder value from .env.example');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  DISCORD_TOKEN: secret('DISCORD_TOKEN', 50),
  DISCORD_CLIENT_ID: snowflake,
  DISCORD_GUILD_ID: z.preprocess((v) => (v === '' ? undefined : v), snowflake.optional()),

  LAVALINK_HOST: z.string().trim().min(1).default('127.0.0.1'),
  LAVALINK_PORT: z.coerce.number().int().min(1).max(65535).default(2333),
  LAVALINK_PASSWORD: secret('LAVALINK_PASSWORD', 12),
  LAVALINK_SECURE: z.stringbool().default(false),

  DATABASE_PATH: z.string().trim().min(1).default('./data/sonaris.db'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_DIR: z.string().trim().min(1).default('./logs'),

  DEFAULT_SEARCH_SOURCE: z.enum(['ytmsearch', 'ytsearch', 'scsearch']).default('ytmsearch'),
  MESSAGE_REQUESTS_ENABLED: z.stringbool().default(false),

  BOT_DEVELOPER: z.string().trim().default('Your Name'),
  BOT_SUPPORT_URL: z.preprocess((v) => (v === '' ? undefined : v), z.url().optional()),
  BOT_WEBSITE_URL: z.preprocess((v) => (v === '' ? undefined : v), z.url().optional()),
  BOT_GITHUB_URL: z.preprocess((v) => (v === '' ? undefined : v), z.url().optional()),
});

export type Env = Omit<z.infer<typeof schema>, 'DATABASE_PATH' | 'LOG_DIR'> & {
  DATABASE_PATH: string;
  LOG_DIR: string;
};

export class EnvValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

/** Validates a raw environment object. Kept pure so it can be unit tested. */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`);
    throw new EnvValidationError(problems);
  }
  const data = result.data;
  return {
    ...data,
    DATABASE_PATH: path.resolve(data.DATABASE_PATH),
    LOG_DIR: path.resolve(data.LOG_DIR),
  };
}

let cached: Env | undefined;

export function loadEnv(): Env {
  if (cached) return cached;
  loadDotenv({ quiet: true });
  cached = parseEnv(process.env);
  return cached;
}

/** Values that must never appear in log output. */
export function secretsOf(env: Env): string[] {
  return [env.DISCORD_TOKEN, env.LAVALINK_PASSWORD];
}
