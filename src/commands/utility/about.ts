import { version as discordJsVersion, SlashCommandBuilder } from 'discord.js';
import { baseEmbed } from '../../components/embeds/common.js';
import { BRAND, dependencyVersion, ICONS } from '../../config/brand.js';
import type { SlashCommand } from '../../types/index.js';
import { formatUptime } from '../../utils/format.js';

const command: SlashCommand = {
  category: 'utility',
  usage: '/about',
  data: new SlashCommandBuilder().setName('about').setDescription(`Learn about ${BRAND.name}.`),

  async execute(interaction, app) {
    const node = app.lavalink.nodeManager.leastUsedNodes()[0];
    const { env } = app;
    const links = [
      env.BOT_SUPPORT_URL && `[Support server](${env.BOT_SUPPORT_URL})`,
      env.BOT_WEBSITE_URL && `[Website](${env.BOT_WEBSITE_URL})`,
      env.BOT_GITHUB_URL && `[GitHub](${env.BOT_GITHUB_URL})`,
      `[Invite](https://discord.com/oauth2/authorize?client_id=${env.DISCORD_CLIENT_ID}&scope=bot%20applications.commands&permissions=3238912)`,
    ].filter(Boolean);

    const backend = node?.info
      ? `Lavalink ${node.info.version.semver}\n${node.info.plugins.map((p) => p.name).join(', ') || 'no plugins'}`
      : 'Lavalink (offline)';

    const embed = baseEmbed()
      .setAuthor({ name: `${ICONS.music} ${BRAND.name}` })
      .setTitle(BRAND.tagline)
      .setDescription(BRAND.description)
      .addFields(
        { name: 'Version', value: `v${BRAND.version}`, inline: true },
        { name: 'Developer', value: env.BOT_DEVELOPER, inline: true },
        { name: 'Uptime', value: formatUptime(Date.now() - app.startedAt), inline: true },
        { name: 'Servers', value: app.client.guilds.cache.size.toLocaleString('en-US'), inline: true },
        { name: 'Active players', value: String(app.lavalink.players.size), inline: true },
        { name: 'Memory', value: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`, inline: true },
        { name: 'Library', value: `discord.js ${discordJsVersion}\nlavalink-client ${dependencyVersion('lavalink-client')}\nNode.js ${process.version}`, inline: true },
        { name: 'Music backend', value: backend, inline: true },
        { name: 'Links', value: links.join(' • '), inline: false },
      );
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
