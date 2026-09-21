import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import { runSearchInterface } from '../../interactions/search.js';
import type { SlashCommand } from '../../types/index.js';
import type { GuildChatInput } from '../shared.js';

const command: SlashCommand = {
  category: 'music',
  usage: '/search <query>',
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for a song and choose from the top results.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName('query').setDescription('What do you want to listen to?').setRequired(true).setMaxLength(200)),

  async execute(interaction, app) {
    const i = interaction as GuildChatInput;
    await runSearchInterface(i, app, i.options.getString('query', true));
  },
};

export default command;
