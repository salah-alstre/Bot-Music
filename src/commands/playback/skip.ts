import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import * as actions from '../../music/actions.js';
import type { SlashCommand } from '../../types/index.js';
import { runControl, type GuildChatInput } from '../shared.js';

const command: SlashCommand = {
  category: 'playback',
  usage: '/skip [to]',
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current track, or jump to a position in the queue.')
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption((o) => o.setName('to').setDescription('Queue position to jump to').setMinValue(1).setMaxValue(1000)),

  async execute(interaction, app) {
    const i = interaction as GuildChatInput;
    const to = i.options.getInteger('to') ?? undefined;
    await runControl(i, app, { needsTrack: true }, (player) => actions.skip(app, player, to));
  },
};

export default command;
