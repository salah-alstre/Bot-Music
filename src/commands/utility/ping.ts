import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { baseEmbed } from '../../components/embeds/common.js';
import { ICONS } from '../../config/brand.js';
import type { SlashCommand } from '../../types/index.js';

const command: SlashCommand = {
  category: 'utility',
  usage: '/ping',
  data: new SlashCommandBuilder().setName('ping').setDescription('Check latency to Discord and the music backend.'),

  async execute(interaction, app) {
    const started = Date.now();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const roundTrip = Date.now() - started;

    const node = app.lavalink.nodeManager.leastUsedNodes()[0];
    const backend = node ? `${Math.max(0, Math.round(node.heartBeatPing))} ms` : 'Offline';

    const embed = baseEmbed()
      .setAuthor({ name: `${ICONS.ping} Pong!` })
      .addFields(
        { name: 'Discord gateway', value: `${Math.round(app.client.ws.ping)} ms`, inline: true },
        { name: 'Command round trip', value: `${roundTrip} ms`, inline: true },
        { name: 'Music backend', value: backend, inline: true },
      );
    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
