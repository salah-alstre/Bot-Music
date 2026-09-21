import type { SlashCommand } from '../types/index.js';
import joinCommand from './music/join.js';
import leaveCommand from './music/leave.js';
import lyricsCommand from './music/lyrics.js';
import playCommand from './music/play.js';
import searchCommand from './music/search.js';
import autoplayCommand from './playback/autoplay.js';
import loopCommand from './playback/loop.js';
import nowplayingCommand from './playback/nowplaying.js';
import pauseCommand from './playback/pause.js';
import previousCommand from './playback/previous.js';
import resumeCommand from './playback/resume.js';
import seekCommand from './playback/seek.js';
import skipCommand from './playback/skip.js';
import stopCommand from './playback/stop.js';
import volumeCommand from './playback/volume.js';
import clearCommand from './queue/clear.js';
import moveCommand from './queue/move.js';
import queueCommand from './queue/queue.js';
import removeCommand from './queue/remove.js';
import shuffleCommand from './queue/shuffle.js';
import filterCommand from './filters/filter.js';
import settingsCommand from './settings/settings.js';
import setupCommand from './settings/setup.js';
import aboutCommand from './utility/about.js';
import helpCommand from './utility/help.js';
import pingCommand from './utility/ping.js';

/** Every slash command the bot exposes. Adding a command means adding it here, which keeps registration explicit and testable. */
export const commands: readonly SlashCommand[] = [
  joinCommand,
  leaveCommand,
  lyricsCommand,
  playCommand,
  searchCommand,
  autoplayCommand,
  loopCommand,
  nowplayingCommand,
  pauseCommand,
  previousCommand,
  resumeCommand,
  seekCommand,
  skipCommand,
  stopCommand,
  volumeCommand,
  clearCommand,
  moveCommand,
  queueCommand,
  removeCommand,
  shuffleCommand,
  filterCommand,
  settingsCommand,
  setupCommand,
  aboutCommand,
  helpCommand,
  pingCommand,
];
