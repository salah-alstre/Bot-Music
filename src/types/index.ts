import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import type { App } from '../app.js';

export const COMMAND_CATEGORIES = ['music', 'queue', 'playback', 'filters', 'settings', 'utility'] as const;
export type CommandCategory = (typeof COMMAND_CATEGORIES)[number];

export type CommandData = SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;

export interface SlashCommand {
  data: CommandData;
  category: CommandCategory;
  /** Short usage hint shown in /help, for example "/play <query>". */
  usage?: string;
  execute(interaction: ChatInputCommandInteraction, app: App): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction, app: App): Promise<void>;
}

