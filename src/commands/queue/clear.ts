import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import * as actions from '../../music/actions.js';
import type { SlashCommand } from '../../types/index.js';
import { runControl, type GuildChatInput } from '../shared.js';

const command: SlashCommand = {
  category: 'queue',
  usage: '/clear',
  data: new SlashCommandBuilder().setName('clear').setDescription('Remove every track from the queue.').setContexts(InteractionContextType.Guild),

  async execute(interaction, app) {
    await runControl(interaction as GuildChatInput, app, { dj: true }, (player) => actions.clearQueue(app, player));
  },
};

export default command;
