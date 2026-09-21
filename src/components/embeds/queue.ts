import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { Player } from 'lavalink-client';
import { ICONS, LIMITS } from '../../config/brand.js';
import { artistOf, durationOf, requesterOf, trackLink } from '../../music/track.js';
import { sumDurations } from '../../music/queueOps.js';
import { formatDuration, formatTrackLength, pluralize } from '../../utils/format.js';
import { paginate } from '../../utils/pagination.js';
import { baseEmbed } from './common.js';
import { loopLabel } from './player.js';

export const QUEUE_PAGE_PREFIX = 'queue:page:';

export function buildQueueView(player: Player, requestedPage: number) {
  const tracks = player.queue.tracks;
  const page = paginate(tracks, requestedPage, LIMITS.queuePageSize);
  const current = player.queue.current;

  const lines: string[] = [];
  if (current) {
    lines.push(
      `**${ICONS.play} Now playing**`,
      `${trackLink(current, 55)} — ${artistOf(current)} \`${formatTrackLength(durationOf(current), current.info.isStream)}\``,
      '',
    );
  }

  if (tracks.length === 0) {
    lines.push('*The queue is empty. Add songs with `/play`.*');
  } else {
    lines.push(`**${ICONS.queue} Up next**`);
    page.items.forEach((track, i) => {
      const requester = requesterOf(track);
      lines.push(
        `\`${String(page.startIndex + i + 1).padStart(2, ' ')}.\` ${trackLink(track, 48)} — ${artistOf(track)} \`${formatTrackLength(durationOf(track), track.info.isStream)}\`${requester ? ` • ${requester.username}` : ''}`,
      );
    });
  }

  const total = sumDurations(tracks.map((t) => (t.info.isStream ? 0 : durationOf(t))));
  const embed = baseEmbed()
    .setAuthor({ name: `${ICONS.queue} Queue` })
    .setDescription(lines.join('\n').slice(0, 4000))
    .setFooter({
      text: `Page ${page.page}/${page.totalPages} • ${pluralize(tracks.length, 'track')} • ${formatDuration(total)} • Loop: ${loopLabel(player.repeatMode).replace(/^\S+\s/, '')}`,
    });

  const components =
    page.totalPages > 1
      ? [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`${QUEUE_PAGE_PREFIX}1`).setEmoji('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(page.page === 1),
            new ButtonBuilder().setCustomId(`${QUEUE_PAGE_PREFIX}${page.page - 1}`).setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page.page === 1),
            new ButtonBuilder().setCustomId(`${QUEUE_PAGE_PREFIX}${page.page}`).setEmoji('🔄').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`${QUEUE_PAGE_PREFIX}${page.page + 1}`).setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(page.page === page.totalPages),
            new ButtonBuilder().setCustomId(`${QUEUE_PAGE_PREFIX}${page.totalPages}`).setEmoji('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(page.page === page.totalPages),
          ),
        ]
      : [];

  return { embeds: [embed], components };
}
