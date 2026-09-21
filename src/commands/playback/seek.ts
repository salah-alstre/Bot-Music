import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import * as actions from '../../music/actions.js';
import type { SlashCommand } from '../../types/index.js';
import { UserError } from '../../utils/errors.js';
import { parseTimeInput } from '../../utils/format.js';
import { runControl, type GuildChatInput } from '../shared.js';

const command: SlashCommand = {
  category: 'playback',
  usage: '/seek <time>',
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Jump to a position in the current track.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName('time').setDescription('Examples: 1:30, 90, 1m30s, +30, -15').setRequired(true).setMaxLength(12)),

  async execute(interaction, app) {
    const i = interaction as GuildChatInput;
    const parsed = parseTimeInput(i.options.getString('time', true));
    if (!parsed) throw new UserError('I could not read that time. Try `1:30`, `90`, `1m30s`, `+30` or `-15`.');
    await runControl(i, app, { dj: true, needsTrack: true }, (player) => actions.seek(app, player, parsed.ms, parsed.relative));
  },
};

export default command;
