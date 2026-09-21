import { MessageFlags, SlashCommandBuilder, InteractionContextType } from 'discord.js';
import { runSearchInterface } from '../../interactions/search.js';
import { requireVoiceChannel } from '../../music/guards.js';
import { playQuery } from '../../music/playback.js';
import type { SlashCommand } from '../../types/index.js';
import { actorOf } from '../../utils/interactions.js';
import type { GuildChatInput } from '../shared.js';

const command: SlashCommand = {
  category: 'music',
  usage: '/play <query> [next] [choose]',
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song, playlist or link from YouTube, SoundCloud or Spotify.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) =>
      o.setName('query').setDescription('Song name, or a YouTube / SoundCloud / Spotify link').setRequired(true).setMaxLength(300),
    )
    .addBooleanOption((o) => o.setName('next').setDescription('Play this right after the current track'))
    .addBooleanOption((o) => o.setName('choose').setDescription('Pick from the top search results instead of playing the first match')),

  async execute(interaction, app) {
    const i = interaction as GuildChatInput;
    const query = i.options.getString('query', true);

    if (i.options.getBoolean('choose')) {
      await runSearchInterface(i, app, query);
      return;
    }

    const actor = actorOf(i);
    requireVoiceChannel(actor.member);

    // With a persistent controller the channel already shows what is playing, so confirmations stay private.
    const hasController = Boolean(app.settings.get(i.guildId).controllerMessageId);
    await i.deferReply(hasController ? { flags: MessageFlags.Ephemeral } : {});

    const { embed } = await playQuery(app, actor, i.channelId, query, { next: i.options.getBoolean('next') ?? false });
    await i.editReply({ embeds: [embed] });
  },
};

export default command;
