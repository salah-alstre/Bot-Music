import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import * as actions from '../../music/actions.js';
import type { SlashCommand } from '../../types/index.js';
import { runControl, type GuildChatInput } from '../shared.js';

const command: SlashCommand = {
  category: 'music',
  usage: '/leave',
  data: new SlashCommandBuilder().setName('leave').setDescription('Disconnect me from the voice channel and end the session.').setContexts(InteractionContextType.Guild),

  async execute(interaction, app) {
    await runControl(interaction as GuildChatInput, app, { dj: true }, (player) => actions.leave(player));
  },
};

export default command;
