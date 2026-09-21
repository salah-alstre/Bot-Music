import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import type { App } from '../app.js';
import { FILTER_MENU_ID, PANEL_PREFIX, type PanelAction } from '../components/controls.js';
import { ephemeral, successEmbed } from '../components/embeds/common.js';
import { buildQueueView } from '../components/embeds/queue.js';
import * as actions from '../music/actions.js';
import { requireControl, requirePlayer, requireVoiceChannel, assertSameChannel } from '../music/guards.js';
import { playQuery } from '../music/playback.js';
import { UserError } from '../utils/errors.js';
import { parseTimeInput } from '../utils/format.js';
import { actorOf, deferComponentUpdate } from '../utils/interactions.js';
import { deliverLyrics } from './lyrics.js';

export const ADD_MODAL_ID = `${PANEL_PREFIX}add-modal`;
export const SEEK_MODAL_ID = `${PANEL_PREFIX}seek-modal`;

function addModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(ADD_MODAL_ID)
    .setTitle('Add a song')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('query')
          .setLabel('Song name or link')
          .setPlaceholder('Arctic Monkeys Do I Wanna Know, or a YouTube / SoundCloud / Spotify link')
          .setStyle(TextInputStyle.Short)
          .setMinLength(2)
          .setMaxLength(300)
          .setRequired(true),
      ),
    );
}

function seekModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(SEEK_MODAL_ID)
    .setTitle('Seek')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('time')
          .setLabel('Time to jump to')
          .setPlaceholder('1:30, 90, 1m30s, +30 or -15')
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(12)
          .setRequired(true),
      ),
    );
}

export async function handlePanelButton(interaction: ButtonInteraction<'cached'>, app: App): Promise<void> {
  const action = interaction.customId.slice(PANEL_PREFIX.length) as PanelAction;
  const actor = actorOf(interaction);

  // Actions that open UI must respond with it directly, so they validate first and never defer.
  switch (action) {
    case 'add':
      requireVoiceChannel(actor.member);
      await interaction.showModal(addModal());
      return;
    case 'seek':
      requireControl(app, actor, { dj: true, needsTrack: true });
      await interaction.showModal(seekModal());
      return;
    case 'queue': {
      const player = requirePlayer(app, actor.guild.id);
      await interaction.reply(ephemeral(buildQueueView(player, 1)));
      return;
    }
    case 'lyrics': {
      requirePlayer(app, actor.guild.id);
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await deliverLyrics(interaction, app, null);
      return;
    }
    default:
      break;
  }

  await deferComponentUpdate(interaction);

  switch (action) {
    case 'previous':
      await actions.previous(app, requireControl(app, actor));
      break;
    case 'toggle':
      await actions.togglePause(app, requireControl(app, actor, { needsTrack: true }));
      break;
    case 'skip':
      await actions.skip(app, requireControl(app, actor, { needsTrack: true }));
      break;
    case 'stop':
      await actions.stop(app, requireControl(app, actor, { dj: true }));
      break;
    case 'loop':
      await actions.cycleLoop(app, requireControl(app, actor, { dj: true, needsTrack: true }));
      break;
    case 'shuffle':
      await actions.shuffle(app, requireControl(app, actor, { dj: true }));
      break;
    case 'voldown':
      await actions.stepVolume(app, requireControl(app, actor, { dj: true, needsTrack: true }), -1);
      break;
    case 'volup':
      await actions.stepVolume(app, requireControl(app, actor, { dj: true, needsTrack: true }), 1);
      break;
    case 'autoplay':
      actions.toggleAutoplay(app, requireControl(app, actor, { dj: true }));
      break;
    default:
      throw new UserError('That button is no longer available.');
  }
  app.panel.request(actor.guild.id, { immediate: true });
}

export async function handleFilterMenu(interaction: StringSelectMenuInteraction<'cached'>, app: App): Promise<void> {
  if (interaction.customId !== FILTER_MENU_ID) return;
  const actor = actorOf(interaction);
  const player = requireControl(app, actor, { dj: true, needsTrack: true });
  await deferComponentUpdate(interaction);
  const key = interaction.values[0];
  if (!key) throw new UserError('Pick a filter from the menu.');
  await actions.setFilter(app, player, key);
  app.panel.request(actor.guild.id, { immediate: true });
}

export async function handlePanelModal(interaction: ModalSubmitInteraction<'cached'>, app: App): Promise<void> {
  const actor = actorOf(interaction);

  if (interaction.customId === ADD_MODAL_ID) {
    const query = interaction.fields.getTextInputValue('query').trim();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const { embed } = await playQuery(app, actor, interaction.channelId, query);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (interaction.customId === SEEK_MODAL_ID) {
    const parsed = parseTimeInput(interaction.fields.getTextInputValue('time'));
    if (!parsed) throw new UserError('I could not read that time. Try `1:30`, `90`, `1m30s`, `+30` or `-15`.');
    const player = requireControl(app, actor, { dj: true, needsTrack: true });
    assertSameChannel(player, actor.member);
    const message = await actions.seek(app, player, parsed.ms, parsed.relative);
    await interaction.reply(ephemeral({ embeds: [successEmbed(message)] }));
  }
}
