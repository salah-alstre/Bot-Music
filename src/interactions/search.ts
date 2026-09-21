import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import type { Track } from 'lavalink-client';
import type { App } from '../app.js';
import { baseEmbed, errorEmbed } from '../components/embeds/common.js';
import { ICONS, LIMITS } from '../config/brand.js';
import { requireVoiceChannel } from '../music/guards.js';
import { embedForEnqueue, enqueueTracks, ensurePlayer, playQuery } from '../music/playback.js';
import { resolveQuery } from '../music/search.js';
import { artistOf, durationOf, requesterFrom, sourceLabelOf, trackLink } from '../music/track.js';
import { formatTrackLength, truncate } from '../utils/format.js';
import { actorOf, replyWithError } from '../utils/interactions.js';
import { logger } from '../utils/logger.js';

/**
 * Interactive search: shows up to ten matches, lets the user pick one or several, and expires safely.
 * The result message is ephemeral so searching never spams the channel.
 */
export async function runSearchInterface(interaction: ChatInputCommandInteraction<'cached'>, app: App, query: string): Promise<void> {
  const actor = actorOf(interaction);
  requireVoiceChannel(actor.member);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const outcome = await resolveQuery(app, query, requesterFrom(actor.member), { limit: LIMITS.searchResults });

  // Links and playlists have exactly one sensible result, so no picker is needed.
  if (outcome.kind !== 'search') {
    const { embed } = await playQuery(app, actor, interaction.channelId, query);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const tracks = outcome.tracks;
  const token = interaction.id;
  const selectId = `search:${token}:select`;
  const cancelId = `search:${token}:cancel`;

  const listing = tracks
    .map((track, i) => `\`${String(i + 1).padStart(2, ' ')}.\` ${trackLink(track, 52)}\n      ${artistOf(track)} • \`${formatTrackLength(durationOf(track), track.info.isStream)}\` • ${sourceLabelOf(track)}`)
    .join('\n');

  const embed = baseEmbed()
    .setAuthor({ name: `${ICONS.search} Results for “${truncate(query, 60)}”` })
    .setDescription(`${listing}\n\nChoose one or more tracks below. This menu expires in ${LIMITS.searchTimeoutMs / 1000} seconds.`);
  const artwork = tracks[0]?.info.artworkUrl;
  if (artwork) embed.setThumbnail(artwork);

  const components = (disabled: boolean) => [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(selectId)
        .setPlaceholder('Select tracks to add')
        .setMinValues(1)
        .setMaxValues(tracks.length)
        .setDisabled(disabled)
        .addOptions(
          tracks.map((track, i) => ({
            label: truncate(`${i + 1}. ${track.info.title}`, 100),
            description: truncate(`${artistOf(track)} • ${formatTrackLength(durationOf(track), track.info.isStream)} • ${sourceLabelOf(track)}`, 100),
            value: String(i),
          })),
        ),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(cancelId).setLabel('Cancel').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    ),
  ];

  const message = await interaction.editReply({ embeds: [embed], components: components(false) });

  const collector = message.createMessageComponentCollector({
    time: LIMITS.searchTimeoutMs,
    filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith(`search:${token}:`),
  });

  collector.on('collect', async (component) => {
    try {
      if (component.customId === cancelId) {
        collector.stop('cancelled');
        await component.update({ embeds: [baseEmbed().setDescription('Search cancelled.')], components: [] });
        return;
      }
      if (!component.isStringSelectMenu()) return;

      await component.deferUpdate();
      collector.stop('selected');
      const chosen = component.values.map((v) => tracks[Number(v)]).filter((t): t is Track => Boolean(t));
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const player = await ensurePlayer(app, { guild: interaction.guild, member }, interaction.channelId);
      const result = await enqueueTracks(app, player, chosen);
      const summary = chosen.length === 1 ? embedForEnqueue({ kind: 'track', tracks: chosen, playlist: null }, result, player) : baseEmbed().setDescription(`${ICONS.success} Added **${result.added.length}** tracks to the queue.`);
      await component.editReply({ embeds: [summary], components: [] });
    } catch (error) {
      await replyWithError(component as ButtonInteraction | StringSelectMenuInteraction, error, 'search-select');
    }
  });

  collector.on('end', (_collected, reason) => {
    if (reason !== 'time') return;
    interaction
      .editReply({ embeds: [errorEmbed('This search expired. Run the command again to search again.')], components: components(true) })
      .catch((error: unknown) => logger.debug({ err: error }, 'Could not mark the search as expired'));
  });
}
