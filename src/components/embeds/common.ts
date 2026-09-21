import { EmbedBuilder, type InteractionReplyOptions, MessageFlags } from 'discord.js';
import { BRAND, COLORS, ICONS } from '../../config/brand.js';

export function baseEmbed(color: number = COLORS.primary): EmbedBuilder {
  return new EmbedBuilder().setColor(color).setFooter({ text: BRAND.footer });
}

export function successEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(COLORS.success).setDescription(`${ICONS.success} ${message}`);
}

export function errorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(COLORS.danger).setDescription(`${ICONS.error} ${message}`);
}

export function infoEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(COLORS.primary).setDescription(`${ICONS.info} ${message}`);
}

export const ephemeral = (options: Omit<InteractionReplyOptions, 'flags'>): InteractionReplyOptions => ({
  ...options,
  flags: MessageFlags.Ephemeral,
});

export const ephemeralSuccess = (message: string): InteractionReplyOptions => ephemeral({ embeds: [successEmbed(message)] });
