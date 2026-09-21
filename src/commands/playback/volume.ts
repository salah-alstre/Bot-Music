import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import { ICONS, LIMITS } from '../../config/brand.js';
import * as actions from '../../music/actions.js';
import { requirePlayer } from '../../music/guards.js';
import type { SlashCommand } from '../../types/index.js';
import { actorOf } from '../../utils/interactions.js';
import { confirmation, runControl, type GuildChatInput } from '../shared.js';

const command: SlashCommand = {
  category: 'playback',
  usage: '/volume [level]',
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Show or change the playback volume.')
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption((o) => o.setName('level').setDescription('Volume percentage').setMinValue(LIMITS.minVolume).setMaxValue(LIMITS.absoluteMaxVolume)),

  async execute(interaction, app) {
    const i = interaction as GuildChatInput;
    const level = i.options.getInteger('level');
    if (level === null) {
      const player = requirePlayer(app, actorOf(i).guild.id);
      await i.reply(confirmation(`${ICONS.volumeUp} Current volume is **${player.volume}%** (server maximum ${app.settings.get(i.guildId).maxVolume}%).`, true));
      return;
    }
    await runControl(i, app, { dj: true }, (player) => actions.setVolume(app, player, level));
  },
};

export default command;
