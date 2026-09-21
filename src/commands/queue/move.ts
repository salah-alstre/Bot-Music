import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import * as actions from '../../music/actions.js';
import type { SlashCommand } from '../../types/index.js';
import { runControl, type GuildChatInput } from '../shared.js';

const command: SlashCommand = {
  category: 'queue',
  usage: '/move <from> <to>',
  data: new SlashCommandBuilder()
    .setName('move')
    .setDescription('Move a track to a different position in the queue.')
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption((o) => o.setName('from').setDescription('Current position').setRequired(true).setMinValue(1))
    .addIntegerOption((o) => o.setName('to').setDescription('New position').setRequired(true).setMinValue(1)),

  async execute(interaction, app) {
    const i = interaction as GuildChatInput;
    const from = i.options.getInteger('from', true);
    const to = i.options.getInteger('to', true);
    await runControl(i, app, { dj: true }, (player) => actions.moveTrack(app, player, from, to));
  },
};

export default command;
