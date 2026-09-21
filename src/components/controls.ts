import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, type MessageActionRowComponentBuilder } from 'discord.js';
import type { Player } from 'lavalink-client';
import { ICONS } from '../config/brand.js';
import type { GuildSettings } from '../database/settings.js';
import { activeFilter, CLEAR_FILTER_VALUE, supportedFilters } from '../music/filters.js';
import type { GuildSession } from '../music/session.js';

export const PANEL_PREFIX = 'player:';
export const FILTER_MENU_ID = 'player:filter';

export type PanelAction =
  | 'previous'
  | 'toggle'
  | 'skip'
  | 'stop'
  | 'loop'
  | 'shuffle'
  | 'voldown'
  | 'volup'
  | 'autoplay'
  | 'queue'
  | 'add'
  | 'seek'
  | 'lyrics';

const id = (action: PanelAction) => `${PANEL_PREFIX}${action}`;

function button(action: PanelAction, emoji: string, style: ButtonStyle = ButtonStyle.Secondary, disabled = false, label?: string) {
  const b = new ButtonBuilder().setCustomId(id(action)).setEmoji(emoji).setStyle(style).setDisabled(disabled);
  if (label) b.setLabel(label);
  return b;
}

type Row = ActionRowBuilder<MessageActionRowComponentBuilder>;

/**
 * The control panel layout. Row 1 is the everyday transport, row 2 the extras,
 * row 3 the filter menu and row 4 the helpers that open modals or ephemeral views.
 */
export function buildPanelComponents(player: Player | undefined, session: GuildSession | undefined, settings: GuildSettings): Row[] {
  const hasTrack = Boolean(player?.queue.current);
  const paused = player?.paused ?? false;
  const loop = player?.repeatMode ?? 'off';
  const hasPrevious = (player?.queue.previous.length ?? 0) > 0;
  const off = !hasTrack;

  const loopEmoji = loop === 'track' ? ICONS.loopTrack : loop === 'queue' ? ICONS.loopQueue : ICONS.loopOff;

  const transport = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    button('previous', ICONS.previous, ButtonStyle.Secondary, !hasPrevious),
    button('toggle', paused ? ICONS.play : ICONS.pause, ButtonStyle.Primary, off),
    button('skip', ICONS.skip, ButtonStyle.Secondary, off),
    button('stop', ICONS.stop, ButtonStyle.Danger, !player),
    button('loop', loopEmoji, loop === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success, off),
  );

  const extras = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    button('shuffle', ICONS.shuffle, ButtonStyle.Secondary, (player?.queue.tracks.length ?? 0) < 2),
    button('voldown', ICONS.volumeDown, ButtonStyle.Secondary, off),
    button('volup', ICONS.volumeUp, ButtonStyle.Secondary, off),
    button('autoplay', ICONS.autoplay, session?.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary, !player),
    button('queue', ICONS.queue, ButtonStyle.Secondary, !player),
  );

  const rows: Row[] = [transport, extras];

  const filters = settings.allowFilters ? supportedFilters(player) : [];
  if (filters.length > 0) {
    const current = player ? activeFilter(player) : undefined;
    const menu = new StringSelectMenuBuilder()
      .setCustomId(FILTER_MENU_ID)
      .setPlaceholder(current ? `${ICONS.filter} Filter: ${current.label}` : `${ICONS.filter} Audio filters`)
      .setDisabled(off)
      .addOptions(
        ...filters.map((f) => ({
          label: f.label,
          value: f.key,
          description: f.description.slice(0, 100),
          emoji: f.emoji,
          default: current?.key === f.key,
        })),
        { label: 'Clear filters', value: CLEAR_FILTER_VALUE, description: 'Return to the original sound.', emoji: '🧹' },
      );
    rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu));
  }

  rows.push(
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      button('add', ICONS.add, ButtonStyle.Success, false, 'Add song'),
      button('seek', ICONS.seek, ButtonStyle.Secondary, off, 'Seek'),
      button('lyrics', ICONS.lyrics, ButtonStyle.Secondary, off, 'Lyrics'),
    ),
  );

  return rows;
}
