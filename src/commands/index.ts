import type { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

import { invoice } from './invoice.ts';
import { preview } from './preview.ts';
import { start } from './start.ts';
import { stop } from './stop.ts';

export interface Command {
	data: SlashCommandBuilder;
	execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands = new Map<string, Command>([
	[start.data.name, start],
	[stop.data.name, stop],
	[preview.data.name, preview],
	[invoice.data.name, invoice],
]);
