import path from 'node:path';
import pino, { type DestinationStream, type Logger } from 'pino';
import type { Env } from '../config/env.js';
import { secretsOf } from '../config/env.js';
import { createScrubber, RotatingFileStream } from './rotatingFile.js';

const REDACT_PATHS = [
  'token',
  'password',
  'authorization',
  '*.token',
  '*.password',
  '*.authorization',
  'headers.authorization',
  'config.LAVALINK_PASSWORD',
  'config.DISCORD_TOKEN',
];

/** Logger usable before configuration is loaded (startup errors); replaced by initLogger(). */
export let logger: Logger = pino({ level: 'info', redact: REDACT_PATHS });

function fileDestination(stream: RotatingFileStream): DestinationStream {
  return { write: (chunk: string) => stream.write(chunk) };
}

export async function initLogger(env: Env): Promise<Logger> {
  const scrub = createScrubber(secretsOf(env));
  const maxBytes = 10 * 1024 * 1024;
  const streams: pino.StreamEntry[] = [];

  if (env.NODE_ENV === 'production') {
    streams.push({ level: env.LOG_LEVEL, stream: { write: (chunk: string) => void process.stdout.write(scrub(chunk)) } });
  } else {
    // pino-pretty is a dev dependency and is never loaded in production.
    const { default: pretty } = await import('pino-pretty');
    streams.push({
      level: env.LOG_LEVEL,
      stream: pretty({ colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname', destination: 1, sync: true }),
    });
  }

  streams.push({
    level: env.LOG_LEVEL,
    stream: fileDestination(
      new RotatingFileStream({ filePath: path.join(env.LOG_DIR, 'bot.log'), maxBytes, maxFiles: 10, transform: scrub }),
    ),
  });
  streams.push({
    level: 'error',
    stream: fileDestination(
      new RotatingFileStream({ filePath: path.join(env.LOG_DIR, 'error.log'), maxBytes, maxFiles: 10, transform: scrub }),
    ),
  });

  logger = pino(
    {
      level: env.LOG_LEVEL,
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      timestamp: pino.stdTimeFunctions.isoTime,
      base: { app: 'sonaris' },
      serializers: { err: pino.stdSerializers.err },
    },
    pino.multistream(streams, { dedupe: false }),
  );
  return logger;
}
