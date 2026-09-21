import { PermissionFlagsBits } from 'discord.js';
import { UserError } from '../../utils/errors.js';
import type { GuildChatInput } from '../shared.js';

/** Runtime check in addition to the command's default permissions, because server admins can override those. */
export function requireManageGuild(interaction: GuildChatInput): void {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    throw new UserError('You need the **Manage Server** permission to change these settings.');
  }
}
