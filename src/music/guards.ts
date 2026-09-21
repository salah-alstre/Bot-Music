import {
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type VoiceBasedChannel,
} from 'discord.js';
import type { Player } from 'lavalink-client';
import type { App } from '../app.js';
import { UserError } from '../utils/errors.js';

export interface Actor {
  guild: Guild;
  member: GuildMember;
}

export function humansIn(channel: VoiceBasedChannel): number {
  return channel.members.filter((m) => !m.user.bot).size;
}

export function requireVoiceChannel(member: GuildMember): VoiceBasedChannel {
  const channel = member.voice.channel;
  if (!channel) throw new UserError('Join a voice channel first, then try again.');
  if (channel.type === ChannelType.GuildStageVoice) {
    throw new UserError('Stage channels are not supported yet. Please use a regular voice channel.');
  }
  return channel;
}

/** Verifies the bot can actually join and speak, so users get a precise message instead of a silent failure. */
export function assertCanJoin(guild: Guild, channel: VoiceBasedChannel): void {
  const me = guild.members.me;
  if (!me) throw new UserError("I'm still starting up in this server. Please try again in a few seconds.");
  const permissions = channel.permissionsFor(me);

  if (!permissions.has(PermissionFlagsBits.ViewChannel)) throw new UserError(`I can't see ${channel}. Please give me the **View Channel** permission.`);
  if (!permissions.has(PermissionFlagsBits.Connect)) throw new UserError(`I can't join ${channel}. Please give me the **Connect** permission.`);
  if (!permissions.has(PermissionFlagsBits.Speak)) throw new UserError(`I can't speak in ${channel}. Please give me the **Speak** permission.`);
  if (channel.userLimit > 0 && channel.members.size >= channel.userLimit && !permissions.has(PermissionFlagsBits.MoveMembers) && me.voice.channelId !== channel.id) {
    throw new UserError(`${channel} is full, so I can't join it.`);
  }
}

export function getPlayer(app: App, guildId: string): Player | undefined {
  return app.lavalink.getPlayer(guildId);
}

export function requirePlayer(app: App, guildId: string): Player {
  const player = getPlayer(app, guildId);
  if (!player) throw new UserError("I'm not playing anything in this server right now.");
  return player;
}

export function requireActivePlayer(app: App, guildId: string): Player {
  const player = requirePlayer(app, guildId);
  if (!player.queue.current) throw new UserError('Nothing is playing right now. Use `/play` to start something.');
  return player;
}

/** Users may only control the player from the voice channel the bot is in. */
export function assertSameChannel(player: Player, member: GuildMember): void {
  const memberChannel = member.voice.channelId;
  if (!memberChannel) throw new UserError('Join my voice channel to control the music.');
  if (player.voiceChannelId && memberChannel !== player.voiceChannelId) {
    throw new UserError(`You need to be in <#${player.voiceChannelId}> to control the music.`);
  }
}

function botChannelOf(player: Player, guild: Guild): VoiceBasedChannel | null {
  const id = player.voiceChannelId;
  const channel = id ? guild.channels.cache.get(id) : null;
  return channel?.isVoiceBased() ? channel : null;
}

/**
 * DJ rules: when a DJ role is configured, sensitive actions need that role, Manage Server,
 * or being the only listener. Everyone else keeps the basic controls. No DJ role means no restriction.
 */
export function assertDj(app: App, actor: Actor, player: Player | undefined): void {
  const { djRoleId } = app.settings.get(actor.guild.id);
  if (!djRoleId) return;
  if (actor.member.roles.cache.has(djRoleId)) return;
  if (actor.member.permissions.has(PermissionFlagsBits.ManageGuild)) return;

  const channel = player ? botChannelOf(player, actor.guild) : null;
  if (channel && humansIn(channel) <= 1 && channel.members.has(actor.member.id)) return;

  throw new UserError(`This action is limited to members with the <@&${djRoleId}> role.`);
}

export interface ControlOptions {
  /** Requires the DJ role (when one is configured). */
  dj?: boolean;
  /** Requires a track to be loaded, not just a player. */
  needsTrack?: boolean;
}

/** Single gate used by every slash command, button and menu that changes playback. */
export function requireControl(app: App, actor: Actor, options: ControlOptions = {}): Player {
  const player = options.needsTrack ? requireActivePlayer(app, actor.guild.id) : requirePlayer(app, actor.guild.id);
  assertSameChannel(player, actor.member);
  if (options.dj) assertDj(app, actor, player);
  return player;
}
