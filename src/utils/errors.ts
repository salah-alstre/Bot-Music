import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';
import { logger } from './logger.js';

/**
 * An error whose message is safe and useful to show to end users.
 * Everything else is treated as unexpected and reported generically.
 */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}

const IGNORABLE_DISCORD_CODES = new Set<number>([
  RESTJSONErrorCodes.UnknownInteraction,
  RESTJSONErrorCodes.UnknownMessage,
  RESTJSONErrorCodes.InteractionHasAlreadyBeenAcknowledged,
]);

export function isDiscordError(error: unknown, ...codes: number[]): error is DiscordAPIError {
  return error instanceof DiscordAPIError && codes.includes(Number(error.code));
}

/** True for "interaction expired / message deleted" style failures that need no user-facing handling. */
export function isIgnorableDiscordError(error: unknown): boolean {
  return error instanceof DiscordAPIError && IGNORABLE_DISCORD_CODES.has(Number(error.code));
}

export function toUserMessage(error: unknown, context: string): string {
  if (error instanceof UserError) return error.message;

  if (error instanceof DiscordAPIError) {
    if (error.code === RESTJSONErrorCodes.MissingPermissions || error.code === RESTJSONErrorCodes.MissingAccess) {
      return "I'm missing a permission needed to do that. Please check my role and channel permissions.";
    }
    if (error.code === RESTJSONErrorCodes.UnknownInteraction) {
      return 'That interaction expired. Please run the command again.';
    }
  }

  logger.error({ err: error, context }, 'Unexpected error while handling an interaction');
  return 'Something went wrong on my side. Please try again in a moment.';
}
