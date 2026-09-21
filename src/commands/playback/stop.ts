import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import * as actions from '../../music/actions.js';
import type { SlashCommand } from '../../types/index.js';
import { runControl, type GuildChatInput } from '../shared.js';

const command: SlashCommand = {
  category: 'playback',
  usage: '/stop',
  data: new SlashCommandBuilder().setName('stop').setDescription('Stop playback and clear the queue.').setContexts(InteractionContextType.Guild),

  async execute(interaction, app) {
    await runControl(interaction as GuildChatInput, app, { dj: true }, (player) => actions.stop(app, player));
  },
};

export default command;
