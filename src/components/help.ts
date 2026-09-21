import { ActionRowBuilder, StringSelectMenuBuilder, type EmbedBuilder } from 'discord.js';
import type { App } from '../app.js';
import { BRAND, ICONS } from '../config/brand.js';
import { COMMAND_CATEGORIES, type CommandCategory } from '../types/index.js';
import { baseEmbed } from './embeds/common.js';

export const HELP_MENU_ID = 'help:category';

const CATEGORY_INFO: Record<CommandCategory, { label: string; emoji: string; blurb: string }> = {
  music: { label: 'Music', emoji: ICONS.music, blurb: 'Start listening: play, search and manage the voice connection.' },
  playback: { label: 'Playback', emoji: ICONS.play, blurb: 'Control what is playing right now.' },
  queue: { label: 'Queue', emoji: ICONS.queue, blurb: 'View and organize upcoming tracks.' },
  filters: { label: 'Filters', emoji: ICONS.filter, blurb: 'Shape the sound with audio filters.' },
  settings: { label: 'Settings', emoji: ICONS.settings, blurb: 'Server configuration for admins.' },
  utility: { label: 'Utility', emoji: ICONS.info, blurb: 'Bot information and diagnostics.' },
};

function commandsIn(app: App, category: CommandCategory) {
  return [...app.commands.values()].filter((c) => c.category === category).sort((a, b) => a.data.name.localeCompare(b.data.name));
}

export function buildHelpHome(app: App): EmbedBuilder {
  const lines = COMMAND_CATEGORIES.map((category) => {
    const info = CATEGORY_INFO[category];
    return `${info.emoji} **${info.label}** — ${info.blurb} \`${commandsIn(app, category).length}\``;
  });

  return baseEmbed()
    .setAuthor({ name: `${ICONS.music} ${BRAND.name} Help` })
    .setTitle(BRAND.tagline)
    .setDescription(
      [
        `Get started with \`/play\` and a song name or link. YouTube, SoundCloud and Spotify are supported.`,
        '',
        ...lines,
        '',
        'Choose a category below to see its commands.',
      ].join('\n'),
    );
}

export function buildHelpCategory(app: App, category: CommandCategory): EmbedBuilder {
  const info = CATEGORY_INFO[category];
  const commands = commandsIn(app, category);
  const body = commands.map((c) => `**${c.usage ?? `/${c.data.name}`}**\n${c.data.description}`).join('\n\n');
  return baseEmbed()
    .setAuthor({ name: `${info.emoji} ${info.label}` })
    .setDescription(body || 'No commands in this category.');
}

export function buildHelpMenu(selected?: CommandCategory) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(HELP_MENU_ID)
    .setPlaceholder('Browse a category')
    .addOptions(
      { label: 'Overview', value: 'home', emoji: '🏠', description: 'Back to the start', default: selected === undefined },
      ...COMMAND_CATEGORIES.map((category) => ({
        label: CATEGORY_INFO[category].label,
        value: category,
        emoji: CATEGORY_INFO[category].emoji,
        description: CATEGORY_INFO[category].blurb.slice(0, 100),
        default: selected === category,
      })),
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

export function isCategory(value: string): value is CommandCategory {
  return (COMMAND_CATEGORIES as readonly string[]).includes(value);
}
