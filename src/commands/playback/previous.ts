import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import * as actions from '../../music/actions.js';
import type { SlashCommand } from '../../types/index.js';
import { runControl, type GuildChatInput } from '../shared.js';

const command: SlashCommand = {
  category: 'playback',
  usage: '/previous',
  data: new SlashCommandBuilder().setName('previous').setDescription('Go back to the previous track.').setContexts(InteractionContextType.Guild),

  async execute(interaction, app) {
    await runControl(interaction as GuildChatInput, app, {  }, (player) => actions.previous(app, player));
  },
};

export default command;
