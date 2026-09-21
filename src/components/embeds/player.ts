import type { Player, Track } from 'lavalink-client';
import type { GuildSettings } from '../../database/settings.js';
import { BRAND, COLORS, ICONS } from '../../config/brand.js';
import { activeFilter } from '../../music/filters.js';
import { sumDurations } from '../../music/queueOps.js';
import type { GuildSession } from '../../music/session.js';
import {
  artistOf,
  artworkOf,
  durationOf,
  requesterOf,
  sourceLabelOf,
  trackLink,
  type QueueTrack,
} from '../../music/track.js';
import { formatDuration, formatTrackLength, pluralize, progressBar, truncate } from '../../utils/format.js';
import { baseEmbed } from './common.js';
import type { EmbedBuilder } from 'discord.js';

const LOOP_LABEL = { off: `${ICONS.loopOff} Off`, track: `${ICONS.loopTrack} Track`, queue: `${ICONS.loopQueue} Queue` } as const;

export const loopLabel = (mode: Player['repeatMode']): string => LOOP_LABEL[mode];

export function progressLine(positionMs: number, track: QueueTrack): string {
  if (track.info.isStream) return `${ICONS.live} **LIVE**  ${progressBar(1, 1)}`;
  const duration = durationOf(track);
  return `\`${formatDuration(positionMs)}\`  ${progressBar(positionMs, duration)}  \`${formatDuration(duration)}\``;
}

export function queueSummary(player: Player): string {
  const upcoming = player.queue.tracks;
  if (upcoming.length === 0) return 'Empty';
  const total = sumDurations(upcoming.map((t) => (t.info.isStream ? 0 : durationOf(t))));
  return `${pluralize(upcoming.length, 'track')} • ${formatDuration(total)}`;
}

function upNext(player: Player): string | null {
  const next = player.queue.tracks.slice(0, 3);
  if (next.length === 0) return null;
  return next.map((t, i) => `\`${i + 1}.\` ${trackLink(t, 45)} — ${truncate(artistOf(t), 28)}`).join('\n');
}

export function nowPlayingEmbed(player: Player, session: GuildSession | undefined): EmbedBuilder {
  const track = player.queue.current;
  if (!track) return idleEmbed();

  const paused = player.paused;
  const position = player.position;
  const requester = requesterOf(track);
  const remaining = Math.max(0, durationOf(track) - position);

  const lines = [`by **${artistOf(track)}**`, '', progressLine(position, track)];
  if (!paused && !track.info.isStream && remaining > 0) {
    lines.push(`${ICONS.clock} Ends <t:${Math.floor((Date.now() + remaining) / 1000)}:R>`);
  }

  const embed = baseEmbed(paused ? COLORS.neutral : COLORS.primary)
    .setAuthor({ name: paused ? `${ICONS.pause} Paused` : `${ICONS.play} Now Playing` })
    .setTitle(truncate(track.info.title, 250))
    .setDescription(lines.join('\n'))
    .addFields(
      { name: 'Source', value: sourceLabelOf(track), inline: true },
      { name: 'Volume', value: player.volume === 0 ? `${ICONS.volumeMute} Muted` : `${player.volume}%`, inline: true },
      { name: 'Loop', value: loopLabel(player.repeatMode), inline: true },
      { name: 'Autoplay', value: session?.autoplay ? `${ICONS.autoplay} On` : 'Off', inline: true },
      { name: 'Filter', value: activeFilter(player) ? `${activeFilter(player)?.emoji} ${activeFilter(player)?.label}` : 'Off', inline: true },
      { name: 'Queue', value: queueSummary(player), inline: true },
    );

  if (track.info.uri && /^https?:\/\//.test(track.info.uri)) embed.setURL(track.info.uri);
  const artwork = artworkOf(track);
  if (artwork) embed.setThumbnail(artwork);

  const next = upNext(player);
  if (next) embed.addFields({ name: 'Up next', value: next });

  embed.setFooter({
    text: requester ? `Requested by ${requester.username} • ${BRAND.footer}` : BRAND.footer,
    ...(requester?.avatarUrl ? { iconURL: requester.avatarUrl } : {}),
  });
  return embed;
}

export function idleEmbed(options: { messagesEnabled?: boolean; ended?: boolean } = {}): EmbedBuilder {
  const hint = options.messagesEnabled
    ? 'Type a song name or link in this channel, use `/play`, or press **Add song**.'
    : 'Use `/play` or press **Add song** to start listening.';
  return baseEmbed(COLORS.neutral)
    .setAuthor({ name: `${ICONS.music} ${BRAND.name}` })
    .setTitle(options.ended ? 'Session ended' : 'Nothing is playing')
    .setDescription(`${hint}\n\nSupports YouTube, SoundCloud, Spotify links and plain search.`);
}

export function trackAddedEmbed(track: Track, position: number, etaMs: number | null, queueLength: number): EmbedBuilder {
  const requester = requesterOf(track);
  const embed = baseEmbed()
    .setAuthor({ name: `${ICONS.success} Added to queue` })
    .setDescription(`${trackLink(track, 80)}\nby **${artistOf(track)}**`)
    .addFields(
      { name: 'Duration', value: formatTrackLength(durationOf(track), track.info.isStream), inline: true },
      { name: 'Source', value: sourceLabelOf(track), inline: true },
      { name: 'Position', value: position === 0 ? 'Playing next' : `#${position} of ${queueLength}`, inline: true },
    );
  if (etaMs !== null && etaMs > 0) embed.addFields({ name: 'Estimated wait', value: formatDuration(etaMs), inline: true });
  const artwork = artworkOf(track);
  if (artwork) embed.setThumbnail(artwork);
  if (requester) embed.setFooter({ text: `Requested by ${requester.username}`, ...(requester.avatarUrl ? { iconURL: requester.avatarUrl } : {}) });
  return embed;
}

export function playlistAddedEmbed(name: string, url: string | undefined, tracks: readonly QueueTrack[], thumbnail: string | null): EmbedBuilder {
  const total = sumDurations(tracks.map((t) => (t.info.isStream ? 0 : durationOf(t))));
  const title = url && /^https?:\/\//.test(url) ? `[${truncate(name, 80)}](${url})` : `**${truncate(name, 80)}**`;
  const embed = baseEmbed()
    .setAuthor({ name: `${ICONS.success} Playlist added` })
    .setDescription(title)
    .addFields(
      { name: 'Tracks', value: pluralize(tracks.length, 'track'), inline: true },
      { name: 'Total length', value: formatDuration(total), inline: true },
    );
  const artwork = thumbnail ?? tracks[0]?.info.artworkUrl ?? null;
  if (artwork) embed.setThumbnail(artwork);
  const requester = requesterOf(tracks[0]);
  if (requester) embed.setFooter({ text: `Requested by ${requester.username}`, ...(requester.avatarUrl ? { iconURL: requester.avatarUrl } : {}) });
  return embed;
}

export function settingsSummaryLines(settings: GuildSettings): string[] {
  return [
    `**DJ role:** ${settings.djRoleId ? `<@&${settings.djRoleId}>` : 'Not set'}`,
    `**Default volume:** ${settings.defaultVolume}%`,
    `**Maximum volume:** ${settings.maxVolume}%`,
    `**Idle disconnect:** ${settings.idleTimeoutSeconds}s`,
    `**Autoplay by default:** ${settings.autoplayDefault ? 'On' : 'Off'}`,
    `**Default loop:** ${LOOP_LABEL[settings.defaultLoop]}`,
    `**Filters allowed:** ${settings.allowFilters ? 'Yes' : 'No'}`,
    `**Request channel:** ${settings.requestChannelId ? `<#${settings.requestChannelId}>` : 'Not set'}`,
    `**Message requests:** ${settings.requestMessagesEnabled ? 'On' : 'Off'}`,
    `**Controller:** ${settings.controllerChannelId ? `<#${settings.controllerChannelId}>` : 'Not set'}`,
  ];
}
