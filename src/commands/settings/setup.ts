import { ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, type GuildTextBasedChannel, InteractionContextType } from 'discord.js';
import { ephemeralSuccess, successEmbed } from '../../components/embeds/common.js';
import { ICONS } from '../../config/brand.js';
import type { SlashCommand } from '../../types/index.js';
import { UserError } from '../../utils/errors.js';
import { requireManageGuild } from './permissions.js';
import type { GuildChatInput } from '../shared.js';

const REQUIRED_CHANNEL_PERMISSIONS = [
  [PermissionFlagsBits.ViewChannel, 'View Channel'],
  [PermissionFlagsBits.SendMessages, 'Send Messages'],
  [PermissionFlagsBits.EmbedLinks, 'Embed Links'],
  [PermissionFlagsBits.ReadMessageHistory, 'Read Message History'],
] as const;

const command: SlashCommand = {
  category: 'settings',
  usage: '/setup controller | /setup disable',
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Set up a dedicated music channel with a persistent controller.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('controller')
        .setDescription('Create the persistent music controller in a channel.')
        .addChannelOption((o) =>
          o.setName('channel').setDescription('Channel for the controller').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true),
        )
        .addBooleanOption((o) => o.setName('messages').setDescription('Treat plain messages in that channel as song requests')),
    )
    .addSubcommand((s) => s.setName('disable').setDescription('Remove the controller and turn off message requests.')),

  async execute(interaction, app) {
    const i = interaction as GuildChatInput;
    requireManageGuild(i);

    if (i.options.getSubcommand() === 'disable') {
      await app.panel.removeController(i.guildId);
      app.settings.update(i.guildId, { requestChannelId: null, requestMessagesEnabled: false });
      await i.reply(ephemeralSuccess('The music controller and message requests have been disabled.'));
      return;
    }

    const channel = i.options.getChannel('channel', true) as GuildTextBasedChannel;
    const me = i.guild.members.me;
    const permissions = me ? channel.permissionsFor(me) : null;
    const missing = REQUIRED_CHANNEL_PERMISSIONS.filter(([flag]) => !permissions?.has(flag)).map(([, name]) => name);
    if (missing.length > 0) throw new UserError(`I'm missing these permissions in ${channel}: **${missing.join(', ')}**.`);

    const wantsMessages = i.options.getBoolean('messages') ?? false;
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    await app.panel.createController(i.guild, channel);
    app.settings.update(i.guildId, { requestChannelId: channel.id, requestMessagesEnabled: wantsMessages });

    const notes = [`${ICONS.success} The music controller is now live in ${channel}.`];
    if (wantsMessages && app.env.MESSAGE_REQUESTS_ENABLED) notes.push('Anyone in a voice channel can type a song name or link there to play it.');
    if (wantsMessages && !app.env.MESSAGE_REQUESTS_ENABLED) {
      notes.push(
        '⚠️ Message requests are saved, but the bot host has not enabled the Message Content intent (`MESSAGE_REQUESTS_ENABLED=true`). Slash commands and the **Add song** button work in the meantime.',
      );
    }
    await i.editReply({ embeds: [successEmbed(notes.join('\n'))] });
  },
};

export default command;
