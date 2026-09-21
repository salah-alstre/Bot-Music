import { PermissionFlagsBits, SlashCommandBuilder, InteractionContextType, type SlashCommandSubcommandBuilder } from 'discord.js';
import { baseEmbed, ephemeral, ephemeralSuccess } from '../../components/embeds/common.js';
import { settingsSummaryLines } from '../../components/embeds/player.js';
import { ICONS, LIMITS } from '../../config/brand.js';
import { parseLoopMode } from '../../database/settings.js';
import type { SlashCommand } from '../../types/index.js';
import { requireManageGuild } from './permissions.js';
import type { GuildChatInput } from '../shared.js';

const toggle = (name: string, description: string) => (s: SlashCommandSubcommandBuilder) =>
  s.setName(name).setDescription(description).addBooleanOption((o) => o.setName('enabled').setDescription('Enabled?').setRequired(true));

const command: SlashCommand = {
  category: 'settings',
  usage: '/settings <view|dj|volume|idle|autoplay|loop|filters|requests|reset>',
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription("View and change this server's music settings.")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('view').setDescription('Show the current settings.'))
    .addSubcommand((s) =>
      s
        .setName('dj')
        .setDescription('Choose the DJ role. Leave the role empty to turn DJ mode off.')
        .addRoleOption((o) => o.setName('role').setDescription('Role allowed to use restricted controls')),
    )
    .addSubcommand((s) =>
      s
        .setName('volume')
        .setDescription('Set the default and maximum volume.')
        .addIntegerOption((o) => o.setName('default').setDescription('Volume when a session starts').setMinValue(1).setMaxValue(LIMITS.absoluteMaxVolume))
        .addIntegerOption((o) => o.setName('max').setDescription('Highest volume anyone can set').setMinValue(10).setMaxValue(LIMITS.absoluteMaxVolume)),
    )
    .addSubcommand((s) =>
      s
        .setName('idle')
        .setDescription('How long to wait before leaving an empty or finished session.')
        .addIntegerOption((o) =>
          o.setName('seconds').setDescription('Seconds').setRequired(true).setMinValue(LIMITS.minIdleSeconds).setMaxValue(LIMITS.maxIdleSeconds),
        ),
    )
    .addSubcommand(toggle('autoplay', 'Autoplay default for new sessions.'))
    .addSubcommand((s) =>
      s
        .setName('loop')
        .setDescription('Loop mode default for new sessions.')
        .addStringOption((o) =>
          o
            .setName('mode')
            .setDescription('Mode')
            .setRequired(true)
            .addChoices({ name: 'Off', value: 'off' }, { name: 'Track', value: 'track' }, { name: 'Queue', value: 'queue' }),
        ),
    )
    .addSubcommand(toggle('filters', 'Allow or forbid audio filters.'))
    .addSubcommand(toggle('requests', 'Turn message-based song requests in the request channel on or off.'))
    .addSubcommand((s) => s.setName('reset').setDescription('Reset every setting to its default.')),

  async execute(interaction, app) {
    const i = interaction as GuildChatInput;
    const sub = i.options.getSubcommand();
    const guildId = i.guildId;

    if (sub === 'view') {
      const embed = baseEmbed()
        .setAuthor({ name: `${ICONS.settings} Server settings` })
        .setDescription(settingsSummaryLines(app.settings.get(guildId)).join('\n'));
      await i.reply(ephemeral({ embeds: [embed] }));
      return;
    }

    requireManageGuild(i);
    const current = app.settings.get(guildId);

    switch (sub) {
      case 'dj': {
        const role = i.options.getRole('role');
        app.settings.update(guildId, { djRoleId: role?.id ?? null });
        await i.reply(
          ephemeralSuccess(
            role ? `DJ role set to ${role}. Restricted controls now need that role.` : 'DJ mode is off. Everyone in the voice channel can use every control.',
          ),
        );
        break;
      }
      case 'volume': {
        const max = i.options.getInteger('max') ?? current.maxVolume;
        const requested = Math.min(i.options.getInteger('default') ?? current.defaultVolume, max);
        app.settings.update(guildId, { maxVolume: max, defaultVolume: requested });
        await i.reply(ephemeralSuccess(`Default volume is **${requested}%** and the maximum is **${max}%**.`));
        break;
      }
      case 'idle': {
        const seconds = i.options.getInteger('seconds', true);
        app.settings.update(guildId, { idleTimeoutSeconds: seconds });
        await i.reply(ephemeralSuccess(`I'll leave after **${seconds} seconds** of inactivity.`));
        break;
      }
      case 'autoplay': {
        const enabled = i.options.getBoolean('enabled', true);
        app.settings.update(guildId, { autoplayDefault: enabled });
        await i.reply(ephemeralSuccess(`Autoplay will be **${enabled ? 'on' : 'off'}** for new sessions.`));
        break;
      }
      case 'loop': {
        const mode = parseLoopMode(i.options.getString('mode', true));
        app.settings.update(guildId, { defaultLoop: mode });
        await i.reply(ephemeralSuccess(`New sessions will start with loop mode **${mode}**.`));
        break;
      }
      case 'filters': {
        const enabled = i.options.getBoolean('enabled', true);
        app.settings.update(guildId, { allowFilters: enabled });
        await i.reply(ephemeralSuccess(`Audio filters are now **${enabled ? 'allowed' : 'disabled'}**.`));
        break;
      }
      case 'requests': {
        const enabled = i.options.getBoolean('enabled', true);
        app.settings.update(guildId, { requestMessagesEnabled: enabled });
        const hint = enabled && !current.requestChannelId ? ' Use `/setup controller` to choose the request channel.' : '';
        await i.reply(ephemeralSuccess(`Message requests are now **${enabled ? 'on' : 'off'}**.${hint}`));
        break;
      }
      case 'reset': {
        await app.panel.removeController(guildId);
        app.settings.reset(guildId);
        await i.reply(ephemeralSuccess('All settings were reset to their defaults.'));
        break;
      }
    }
    app.panel.request(guildId, { immediate: true });
  },
};

export default command;
