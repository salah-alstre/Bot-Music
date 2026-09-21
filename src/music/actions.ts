import type { Player, Track } from 'lavalink-client';
import type { App } from '../app.js';
import { ICONS } from '../config/brand.js';
import type { LoopMode } from '../database/settings.js';
import { UserError } from '../utils/errors.js';
import { formatDuration } from '../utils/format.js';
import { applyFilter, findFilter } from './filters.js';
import { clampVolume, moveItem, nextLoopMode, resolveRemovalRange, toZeroBased } from './queueOps.js';
import { LIMITS } from '../config/brand.js';
import { titleOf } from './track.js';

/**
 * High-level playback operations. Slash commands, buttons and select menus all call these,
 * so behavior (and validation) is identical no matter where the request came from.
 * Each action returns a short message suitable for a confirmation reply.
 */

const refresh = (app: App, player: Player) => app.panel.request(player.guildId);

export async function togglePause(app: App, player: Player): Promise<string> {
  if (player.paused) {
    await player.resume();
    refresh(app, player);
    return `${ICONS.play} Resumed.`;
  }
  await player.pause();
  refresh(app, player);
  return `${ICONS.pause} Paused.`;
}

export async function pause(app: App, player: Player): Promise<string> {
  if (player.paused) throw new UserError('The player is already paused.');
  return togglePause(app, player);
}

export async function resume(app: App, player: Player): Promise<string> {
  if (!player.paused) throw new UserError("The player isn't paused.");
  return togglePause(app, player);
}

export async function skip(app: App, player: Player, to?: number): Promise<string> {
  const current = player.queue.current;
  if (!current) throw new UserError('Nothing is playing right now.');
  const queued = player.queue.tracks.length;

  if (to !== undefined) {
    if (toZeroBased(to, queued) === null) throw new UserError(`Pick a position between 1 and ${queued}.`);
    await player.skip(to);
    return `${ICONS.skip} Skipped to track #${to}.`;
  }
  await player.skip(0, false);
  refresh(app, player);
  return `${ICONS.skip} Skipped **${titleOf(current)}**.`;
}

export async function previous(app: App, player: Player): Promise<string> {
  const target = await player.queue.shiftPrevious();
  if (!target) throw new UserError('There is no previous track to go back to.');

  const current = player.queue.current;
  if (current) await player.queue.add(current, 0);
  await player.play({ clientTrack: target, paused: false });
  refresh(app, player);
  return `${ICONS.previous} Playing **${titleOf(target)}** again.`;
}

export async function stop(app: App, player: Player): Promise<string> {
  await player.stopPlaying(true, false);
  refresh(app, player);
  return `${ICONS.stop} Stopped playback and cleared the queue.`;
}

export async function leave(player: Player): Promise<string> {
  await player.destroy('Requested by a user');
  return '👋 Disconnected. See you next time!';
}

export async function shuffle(app: App, player: Player): Promise<string> {
  if (player.queue.tracks.length < 2) throw new UserError('I need at least two queued tracks to shuffle.');
  await player.queue.shuffle();
  refresh(app, player);
  return `${ICONS.shuffle} Shuffled ${player.queue.tracks.length} tracks.`;
}

export async function setLoop(app: App, player: Player, mode: LoopMode): Promise<string> {
  await player.setRepeatMode(mode);
  refresh(app, player);
  const text = { off: 'Loop disabled.', track: 'Looping the current track.', queue: 'Looping the whole queue.' }[mode];
  return `${mode === 'track' ? ICONS.loopTrack : mode === 'queue' ? ICONS.loopQueue : ICONS.loopOff} ${text}`;
}

export const cycleLoop = (app: App, player: Player) => setLoop(app, player, nextLoopMode(player.repeatMode));

export async function setVolume(app: App, player: Player, volume: number): Promise<string> {
  const { maxVolume } = app.settings.get(player.guildId);
  if (volume > maxVolume) throw new UserError(`The maximum volume in this server is **${maxVolume}%**.`);
  const value = clampVolume(volume, maxVolume);
  await player.setVolume(value);
  refresh(app, player);
  return `${value === 0 ? ICONS.volumeMute : value < 50 ? ICONS.volumeDown : ICONS.volumeUp} Volume set to **${value}%**.`;
}

export async function stepVolume(app: App, player: Player, direction: 1 | -1): Promise<string> {
  const { maxVolume } = app.settings.get(player.guildId);
  const target = clampVolume(player.volume + direction * LIMITS.volumeStep, maxVolume);
  if (target === player.volume) throw new UserError(direction > 0 ? `Already at the maximum volume (${maxVolume}%).` : 'Already muted.');
  return setVolume(app, player, target);
}

export function toggleAutoplay(app: App, player: Player, value?: boolean): string {
  const session = app.sessions.getOrCreate(player.guildId, app.settings.get(player.guildId));
  session.autoplay = value ?? !session.autoplay;
  refresh(app, player);
  return session.autoplay
    ? `${ICONS.autoplay} Autoplay is **on**. I'll keep similar music going when the queue ends.`
    : `${ICONS.autoplay} Autoplay is **off**.`;
}

export async function seek(app: App, player: Player, ms: number, relative: boolean): Promise<string> {
  const track = player.queue.current;
  if (!track) throw new UserError('Nothing is playing right now.');
  if (track.info.isStream || !track.info.isSeekable) throw new UserError("This track can't be seeked.");

  const target = relative ? player.position + ms : ms;
  const duration = track.info.duration;
  if (target < 0) return seek(app, player, 0, false);
  if (target >= duration) throw new UserError(`That's past the end of the track (${formatDuration(duration)}).`);
  await player.seek(target);
  refresh(app, player);
  return `${ICONS.seek} Jumped to **${formatDuration(target)}**.`;
}

export async function remove(app: App, player: Player, start: number, end: number | null): Promise<string> {
  const range = resolveRemovalRange(start, end, player.queue.tracks.length);
  if (!range) throw new UserError(`Pick a valid position from 1 to ${player.queue.tracks.length}.`);
  const removed = await player.queue.splice(range.index, range.count);
  refresh(app, player);
  const first = (Array.isArray(removed) ? removed[0] : removed) as Track | undefined;
  return range.count === 1 && first ? `🗑️ Removed **${titleOf(first)}**.` : `🗑️ Removed ${range.count} tracks.`;
}

export async function clearQueue(app: App, player: Player): Promise<string> {
  const count = player.queue.tracks.length;
  if (count === 0) throw new UserError('The queue is already empty.');
  await player.queue.splice(0, count);
  refresh(app, player);
  return `🧹 Cleared ${count} ${count === 1 ? 'track' : 'tracks'} from the queue.`;
}

export async function moveTrack(app: App, player: Player, from: number, to: number): Promise<string> {
  const length = player.queue.tracks.length;
  const result = moveItem(player.queue.tracks, from - 1, to - 1);
  if (!result) throw new UserError(`Positions must be between 1 and ${length}.`);
  const track = result.moved as Track;
  await player.queue.splice(from - 1, 1);
  await player.queue.splice(to - 1, 0, track);
  refresh(app, player);
  return `↕️ Moved **${titleOf(track)}** to position #${to}.`;
}

export async function setFilter(app: App, player: Player, key: string): Promise<string> {
  if (!app.settings.get(player.guildId).allowFilters) throw new UserError('Audio filters are disabled in this server.');
  if (key !== 'clear' && !findFilter(key)) throw new UserError('Unknown filter.');
  const { active } = await applyFilter(player, key);
  refresh(app, player);
  return active ? `${active.emoji} **${active.label}** enabled. It may take a moment to be heard.` : `${ICONS.filter} Filters cleared.`;
}
