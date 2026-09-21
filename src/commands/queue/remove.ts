import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import * as actions from '../../music/actions.js';
import type { SlashCommand } from '../../types/index.js';
import { runControl, type GuildChatInput } from '../shared.js';

const command: SlashCommand = {
  category: 'queue',
  usage: '/remove <position> [to]',
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a track, or a range of tracks, from the queue.')
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption((o) => o.setName('position').setDescription('Position shown in /queue').setRequired(true).setMinValue(1))
    .addIntegerOption((o) => o.setName('to').setDescription('Last position to remove (to remove a range)').setMinValue(1)),

  async execute(interaction, app) {
    const i = interaction as GuildChatInput;
    const start = i.options.getInteger('position', true);
    const end = i.options.getInteger('to');
    await runControl(i, app, { dj: true }, (player) => actions.remove(app, player, start, end));
  },
};

export default command;
