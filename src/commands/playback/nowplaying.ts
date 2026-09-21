import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import { nowPlayingEmbed } from '../../components/embeds/player.js';
import { requireActivePlayer } from '../../music/guards.js';
import type { SlashCommand } from '../../types/index.js';
import type { GuildChatInput } from '../shared.js';

const command: SlashCommand = {
  category: 'playback',
  usage: '/nowplaying',
  data: new SlashCommandBuilder().setName('nowplaying').setDescription('Show what is playing right now.').setContexts(InteractionContextType.Guild),

  async execute(interaction, app) {
    const i = interaction as GuildChatInput;
    const player = requireActivePlayer(app, i.guildId);
    await i.reply({ embeds: [nowPlayingEmbed(player, app.sessions.get(i.guildId))] });
  },
};

export default command;
