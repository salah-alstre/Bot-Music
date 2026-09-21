import { MessageFlags, type ButtonInteraction, type ChatInputCommandInteraction, type EmbedBuilder } from 'discord.js';
import type { App } from '../app.js';
import { baseEmbed, errorEmbed } from '../components/embeds/common.js';
import { ICONS, LIMITS } from '../config/brand.js';
import { getPlayer } from '../music/guards.js';
import { artistOf, titleOf } from '../music/track.js';
import { findLyrics } from '../services/lyrics.js';
import { UserError } from '../utils/errors.js';
import { chunkText } from '../utils/pagination.js';

const MAX_PARTS = 4;

/** Builds the lyrics embeds for a query, or for the track that is currently playing. */
export async function buildLyricsEmbeds(app: App, guildId: string, query: string | null): Promise<EmbedBuilder[]> {
  let title: string;
  let author: string;
  let duration: number | undefined;

  if (query) {
    title = query;
    author = '';
  } else {
    const track = getPlayer(app, guildId)?.queue.current;
    if (!track) throw new UserError('Nothing is playing. Play a song or use `/lyrics query:<artist - title>`.');
    title = titleOf(track);
    author = artistOf(track);
    duration = track.info.duration;
  }

  const lyrics = await findLyrics(title, author, duration);
  if (!lyrics) throw new UserError(`I couldn't find lyrics for **${title.slice(0, 80)}**. Try \`/lyrics query:<artist - title>\`.`);

  const parts = chunkText(lyrics.text, LIMITS.lyricsPageSize);
  const shown = parts.slice(0, MAX_PARTS);
  return shown.map((part, index) => {
    const embed = baseEmbed().setDescription(part).setFooter({ text: `Lyrics via ${lyrics.provider} • Part ${index + 1}/${shown.length}` });
    if (index === 0) embed.setAuthor({ name: `${ICONS.lyrics} ${lyrics.title} — ${lyrics.artist}` });
    if (index === shown.length - 1 && parts.length > shown.length) {
      embed.setDescription(`${part}\n\n*…lyrics truncated because they are very long.*`);
    }
    return embed;
  });
}

type LyricsInteraction = ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>;

/** The interaction must already be deferred (ephemeral). First part edits the reply, the rest follow up. */
export async function deliverLyrics(interaction: LyricsInteraction, app: App, query: string | null): Promise<void> {
  let embeds: EmbedBuilder[];
  try {
    embeds = await buildLyricsEmbeds(app, interaction.guildId, query);
  } catch (error) {
    const message = error instanceof UserError ? error.message : 'Lyrics are unavailable right now. Please try again later.';
    await interaction.editReply({ embeds: [errorEmbed(message)] });
    return;
  }

  const [first, ...rest] = embeds;
  if (first) await interaction.editReply({ embeds: [first] });
  for (const embed of rest) await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
