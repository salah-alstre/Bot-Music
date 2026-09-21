import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import * as actions from '../../music/actions.js';
import { parseLoopMode } from '../../database/settings.js';
import type { SlashCommand } from '../../types/index.js';
import { runControl, type GuildChatInput } from '../shared.js';

const command: SlashCommand = {
  category: 'playback',
  usage: '/loop <mode>',
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set the loop mode.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) =>
      o
        .setName('mode')
        .setDescription('What should repeat?')
        .setRequired(true)
        .addChoices({ name: 'Off', value: 'off' }, { name: 'Current track', value: 'track' }, { name: 'Entire queue', value: 'queue' }),
    ),

  async execute(interaction, app) {
    const i = interaction as GuildChatInput;
    const mode = parseLoopMode(i.options.getString('mode', true));
    await runControl(i, app, { dj: true, needsTrack: true }, (player) => actions.setLoop(app, player, mode));
  },
};

export default command;
