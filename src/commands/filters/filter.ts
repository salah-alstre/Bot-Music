import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import * as actions from '../../music/actions.js';
import { CLEAR_FILTER_VALUE, FILTERS, supportedFilters } from '../../music/filters.js';
import { getPlayer } from '../../music/guards.js';
import type { SlashCommand } from '../../types/index.js';
import { UserError } from '../../utils/errors.js';
import { runControl, type GuildChatInput } from '../shared.js';

const command: SlashCommand = {
  category: 'filters',
  usage: '/filter <type>',
  data: new SlashCommandBuilder()
    .setName('filter')
    .setDescription('Apply an audio filter such as Bass Boost, Nightcore or 8D.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName('type').setDescription('Which filter?').setRequired(true).setAutocomplete(true)),

  async execute(interaction, app) {
    const i = interaction as GuildChatInput;
    const key = i.options.getString('type', true);
    await runControl(i, app, { dj: true, needsTrack: true }, (player) => {
      const allowed = supportedFilters(player);
      if (key !== CLEAR_FILTER_VALUE && !allowed.some((f) => f.key === key)) {
        throw new UserError("That filter isn't supported by the current music backend.");
      }
      return actions.setFilter(app, player, key);
    });
  },

  async autocomplete(interaction, app) {
    const focused = interaction.options.getFocused().toLowerCase();
    const player = interaction.guildId ? getPlayer(app, interaction.guildId) : undefined;
    const options = [
      ...(player ? supportedFilters(player) : FILTERS).map((f) => ({ name: `${f.emoji} ${f.label}`, value: f.key })),
      { name: '🧹 Clear filters', value: CLEAR_FILTER_VALUE },
    ];
    await interaction.respond(options.filter((o) => o.name.toLowerCase().includes(focused)).slice(0, 25));
  },
};

export default command;
