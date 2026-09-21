import { MessageFlags, type ChatInputCommandInteraction, type InteractionReplyOptions } from 'discord.js';
import type { App } from '../app.js';
import { successEmbed } from '../components/embeds/common.js';
import { actorOf } from '../utils/interactions.js';
import { requireControl, type ControlOptions } from '../music/guards.js';

export type GuildChatInput = ChatInputCommandInteraction<'cached'>;

/** Confirmation reply used by simple playback commands. Kept public so the room can see who did what. */
export const confirmation = (message: string, ephemeral = false): InteractionReplyOptions => ({
  embeds: [successEmbed(message)],
  ...(ephemeral ? { flags: MessageFlags.Ephemeral } : {}),
});

/** Runs a playback action after the standard voice/DJ checks and replies with its message. */
export async function runControl(
  interaction: GuildChatInput,
  app: App,
  options: ControlOptions,
  action: (player: ReturnType<typeof requireControl>) => Promise<string> | string,
): Promise<void> {
  const player = requireControl(app, actorOf(interaction), options);
  await interaction.reply(confirmation(await action(player)));
}
