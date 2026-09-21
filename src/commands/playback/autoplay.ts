import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import * as actions from '../../music/actions.js';
import type { SlashCommand } from '../../types/index.js';
import { runControl, type GuildChatInput } from '../shared.js';

const command: SlashCommand = {
  category: 'playback',
  usage: '/autoplay [enabled]',
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Keep similar music playing when the queue runs out.')
    .setContexts(InteractionContextType.Guild)
    .addBooleanOption((o) => o.setName('enabled').setDescription('Turn autoplay on or off (leave empty to toggle)')),

  async execute(interaction, app) {
    const i = interaction as GuildChatInput;
    const enabled = i.options.getBoolean('enabled') ?? undefined;
    await runControl(i, app, { dj: true }, (player) => actions.toggleAutoplay(app, player, enabled));
  },
};

export default command;
