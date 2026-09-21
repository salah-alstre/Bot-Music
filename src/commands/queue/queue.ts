import { MessageFlags, SlashCommandBuilder, InteractionContextType } from 'discord.js';
import { buildQueueView } from '../../components/embeds/queue.js';
import { requirePlayer } from '../../music/guards.js';
import type { SlashCommand } from '../../types/index.js';
import type { GuildChatInput } from '../shared.js';

const command: SlashCommand = {
  category: 'queue',
  usage: '/queue [page]',
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the queue.')
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption((o) => o.setName('page').setDescription('Page number').setMinValue(1)),

  async execute(interaction, app) {
    const i = interaction as GuildChatInput;
    const player = requirePlayer(app, i.guildId);
    await i.reply({ ...buildQueueView(player, i.options.getInteger('page') ?? 1), flags: MessageFlags.Ephemeral });
  },
};

export default command;
