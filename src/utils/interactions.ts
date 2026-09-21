import {
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type GuildMember,
  type InteractionReplyOptions,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { errorEmbed } from '../components/embeds/common.js';
import type { Actor } from '../music/guards.js';
import { isIgnorableDiscordError, toUserMessage } from './errors.js';
import { logger } from './logger.js';

export type RepliableInteraction = ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;
export type GuildInteraction = ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'> | StringSelectMenuInteraction<'cached'> | ModalSubmitInteraction<'cached'>;

export function actorOf(interaction: GuildInteraction): Actor {
  return { guild: interaction.guild, member: interaction.member as GuildMember };
}

const updateDeferred = new WeakSet<object>();

/** Acknowledges a component press without replying, remembering it so errors go out as follow-ups. */
export async function deferComponentUpdate(interaction: ButtonInteraction | StringSelectMenuInteraction): Promise<void> {
  await interaction.deferUpdate();
  updateDeferred.add(interaction);
}

/**
 * Reports a failure to the user in whichever way the interaction still allows
 * (reply, follow-up or edit), and never lets an expired interaction throw again.
 */
export async function replyWithError(interaction: RepliableInteraction, error: unknown, context: string): Promise<void> {
  const message = toUserMessage(error, context);
  const payload: InteractionReplyOptions = { embeds: [errorEmbed(message)], flags: MessageFlags.Ephemeral };

  try {
    if (interaction.deferred && !interaction.replied && !updateDeferred.has(interaction)) {
      await interaction.editReply({ embeds: payload.embeds ?? [], components: [], content: '' });
    } else if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (replyError) {
    if (!isIgnorableDiscordError(replyError)) logger.warn({ err: replyError, context }, 'Failed to deliver an error message');
  }
}
