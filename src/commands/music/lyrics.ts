import { MessageFlags, SlashCommandBuilder, InteractionContextType } from 'discord.js';
import { deliverLyrics } from '../../interactions/lyrics.js';
import type { SlashCommand } from '../../types/index.js';
import type { GuildChatInput } from '../shared.js';

const command: SlashCommand = {
  category: 'music',
  usage: '/lyrics [query]',
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('Show lyrics for the current song, or search for another one.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName('query').setDescription('Artist and title, for example "Queen - Bohemian Rhapsody"').setMaxLength(150)),

  async execute(interaction, app) {
    const i = interaction as GuildChatInput;
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    await deliverLyrics(i, app, i.options.getString('query')?.trim() || null);
  },
};

export default command;
