import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from '../src/config/env.js';

const valid = {
  DISCORD_TOKEN: `${'A'.repeat(24)}.${'b'.repeat(6)}.${'c'.repeat(30)}`,
  DISCORD_CLIENT_ID: '123456789012345678',
  LAVALINK_PASSWORD: 'a-long-random-password',
};

describe('parseEnv', () => {
  it('applies defaults', () => {
    const env = parseEnv(valid);
    expect(env.LAVALINK_HOST).toBe('127.0.0.1');
    expect(env.LAVALINK_PORT).toBe(2333);
    expect(env.LAVALINK_SECURE).toBe(false);
    expect(env.DEFAULT_SEARCH_SOURCE).toBe('ytmsearch');
    expect(env.MESSAGE_REQUESTS_ENABLED).toBe(false);
    expect(env.DISCORD_GUILD_ID).toBeUndefined();
  });

  it('treats empty optional values as unset', () => {
    const env = parseEnv({ ...valid, DISCORD_GUILD_ID: '', BOT_SUPPORT_URL: '' });
    expect(env.DISCORD_GUILD_ID).toBeUndefined();
    expect(env.BOT_SUPPORT_URL).toBeUndefined();
  });

  it('parses booleans and numbers', () => {
    const env = parseEnv({ ...valid, LAVALINK_SECURE: 'true', LAVALINK_PORT: '443', MESSAGE_REQUESTS_ENABLED: 'yes' });
    expect(env).toMatchObject({ LAVALINK_SECURE: true, LAVALINK_PORT: 443, MESSAGE_REQUESTS_ENABLED: true });
  });

  it('reports every problem at once', () => {
    try {
      parseEnv({ DISCORD_TOKEN: 'short', DISCORD_CLIENT_ID: 'abc', LAVALINK_PORT: '99999' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const problems = (error as EnvValidationError).problems.join('\n');
      expect(problems).toContain('DISCORD_TOKEN');
      expect(problems).toContain('DISCORD_CLIENT_ID');
      expect(problems).toContain('LAVALINK_PASSWORD');
      expect(problems).toContain('LAVALINK_PORT');
    }
  });

  it('rejects placeholder secrets copied from .env.example', () => {
    expect(() => parseEnv({ ...valid, DISCORD_TOKEN: 'your-bot-token-goes-here-your-bot-token-goes-here' })).toThrow(EnvValidationError);
    expect(() => parseEnv({ ...valid, LAVALINK_PASSWORD: 'changeme-changeme' })).toThrow(EnvValidationError);
  });

  it('rejects weak Lavalink passwords', () => {
    expect(() => parseEnv({ ...valid, LAVALINK_PASSWORD: 'short' })).toThrow(EnvValidationError);
  });
});
