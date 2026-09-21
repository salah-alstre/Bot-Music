import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import * as actions from '../../music/actions.js';
import type { SlashCommand } from '../../types/index.js';
import { runControl, type GuildChatInput } from '../shared.js';

const command: SlashCommand = {
  category: 'playback',
  usage: '/pause',
  data: new SlashCommandBuilder().setName('pause').setDescription('Pause the current track.').setContexts(InteractionContextType.Guild),

  async execute(interaction, app) {
    await runControl(interaction as GuildChatInput, app, { needsTrack: true }, (player) => actions.pause(app, player));
  },
};

export default command;
