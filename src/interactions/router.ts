import {
  MessageFlags,
  type AutocompleteInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Interaction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import type { App } from '../app.js';
import { buildHelpCategory, buildHelpHome, buildHelpMenu, HELP_MENU_ID, isCategory } from '../components/help.js';
import { infoEmbed } from '../components/embeds/common.js';
import { buildQueueView, QUEUE_PAGE_PREFIX } from '../components/embeds/queue.js';
import { PANEL_PREFIX } from '../components/controls.js';
import { isIgnorableDiscordError } from '../utils/errors.js';
import { replyWithError } from '../utils/interactions.js';
import { logger } from '../utils/logger.js';
import { handleFilterMenu, handlePanelButton, handlePanelModal } from './panel.js';

async function handleQueuePage(interaction: ButtonInteraction<'cached'>, app: App): Promise<void> {
  const page = Number(interaction.customId.slice(QUEUE_PAGE_PREFIX.length));
  const player = app.lavalink.getPlayer(interaction.guildId);
  if (!player) {
    await interaction.update({ embeds: [infoEmbed('The queue is empty because nothing is playing.')], components: [] });
    return;
  }
  await interaction.update(buildQueueView(player, Number.isFinite(page) ? page : 1));
}

async function handleHelpMenu(interaction: StringSelectMenuInteraction, app: App): Promise<void> {
  const value = interaction.values[0] ?? 'home';
  if (isCategory(value)) {
    await interaction.update({ embeds: [buildHelpCategory(app, value)], components: [buildHelpMenu(value)] });
  } else {
    await interaction.update({ embeds: [buildHelpHome(app)], components: [buildHelpMenu()] });
  }
}

async function handleCommand(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const command = app.commands.get(interaction.commandName);
  if (!command) {
    await replyWithError(interaction, new Error(`Unknown command ${interaction.commandName}`), 'unknown-command');
    return;
  }
  if (!interaction.inCachedGuild()) {
    await interaction.reply({ content: 'Music commands only work inside a server.', flags: MessageFlags.Ephemeral });
    return;
  }

  const started = Date.now();
  try {
    await command.execute(interaction, app);
  } catch (error) {
    await replyWithError(interaction, error, `command:${interaction.commandName}`);
  } finally {
    logger.debug({ command: interaction.commandName, guildId: interaction.guildId, ms: Date.now() - started }, 'Command handled');
  }
}

async function handleAutocomplete(interaction: AutocompleteInteraction, app: App): Promise<void> {
  try {
    await app.commands.get(interaction.commandName)?.autocomplete?.(interaction, app);
  } catch (error) {
    if (!isIgnorableDiscordError(error)) logger.debug({ err: error, command: interaction.commandName }, 'Autocomplete failed');
    if (!interaction.responded) await interaction.respond([]).catch(() => undefined);
  }
}

async function handleComponent(interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction, app: App): Promise<void> {
  const id = interaction.customId;
  if (!interaction.inCachedGuild()) return;

  try {
    if (interaction.isButton()) {
      if (id.startsWith(PANEL_PREFIX)) await handlePanelButton(interaction, app);
      else if (id.startsWith(QUEUE_PAGE_PREFIX)) await handleQueuePage(interaction, app);
    } else if (interaction.isStringSelectMenu()) {
      if (id === HELP_MENU_ID) await handleHelpMenu(interaction, app);
      else if (id.startsWith(PANEL_PREFIX)) await handleFilterMenu(interaction, app);
    } else if (interaction.isModalSubmit() && id.startsWith(PANEL_PREFIX)) {
      await handlePanelModal(interaction, app);
    }
    // Ids owned by collectors (for example "search:...") are handled where they were created.
  } catch (error) {
    await replyWithError(interaction, error, `component:${id}`);
  }
}

export async function routeInteraction(interaction: Interaction, app: App): Promise<void> {
  if (interaction.isChatInputCommand()) await handleCommand(interaction, app);
  else if (interaction.isAutocomplete()) await handleAutocomplete(interaction, app);
  else if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) await handleComponent(interaction, app);
}
