import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { buildHelpHome, buildHelpMenu } from '../../components/help.js';
import type { SlashCommand } from '../../types/index.js';

const command: SlashCommand = {
  category: 'utility',
  usage: '/help',
  data: new SlashCommandBuilder().setName('help').setDescription('Browse every command by category.'),

  async execute(interaction, app) {
    await interaction.reply({ embeds: [buildHelpHome(app)], components: [buildHelpMenu()], flags: MessageFlags.Ephemeral });
  },
};

export default command;
