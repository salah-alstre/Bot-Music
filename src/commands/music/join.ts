import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import { ensurePlayer } from '../../music/playback.js';
import { requireVoiceChannel } from '../../music/guards.js';
import type { SlashCommand } from '../../types/index.js';
import { actorOf } from '../../utils/interactions.js';
import { confirmation, type GuildChatInput } from '../shared.js';

const command: SlashCommand = {
  category: 'music',
  usage: '/join',
  data: new SlashCommandBuilder().setName('join').setDescription('Make me join your voice channel.').setContexts(InteractionContextType.Guild),

  async execute(interaction, app) {
    const i = interaction as GuildChatInput;
    const actor = actorOf(i);
    const channel = requireVoiceChannel(actor.member);
    const player = await ensurePlayer(app, actor, i.channelId);
    if (!player.queue.current) app.idle.scheduleQueueIdle(player);
    await i.reply(confirmation(`Joined ${channel}. Use \`/play\` to start the music.`));
  },
};

export default command;
