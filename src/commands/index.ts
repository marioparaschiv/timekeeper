import type {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	SlashCommandOptionsOnlyBuilder,
	SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

import { charge } from './charge.ts';
import { invoice } from './invoice.ts';
import { pending } from './pending.ts';
import { preview } from './preview.ts';
import { settled } from './settled.ts';
import { start } from './start.ts';
import { stop } from './stop.ts';

export interface Command {
	data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
	execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands = new Map<string, Command>([
	[start.data.name, start],
	[stop.data.name, stop],
	[charge.data.name, charge],
	[preview.data.name, preview],
	[invoice.data.name, invoice],
	[pending.data.name, pending],
	[settled.data.name, settled],
]);
