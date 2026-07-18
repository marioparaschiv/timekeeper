import type {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	SlashCommandOptionsOnlyBuilder,
	SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

import { invoices } from './invoices.ts';
import { invoice } from './invoice.ts';
import { preview } from './preview.ts';
import { settled } from './settled.ts';
import { charge } from './charge.ts';
import { client } from './client.ts';
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
	[invoices.data.name, invoices],
	[settled.data.name, settled],
	[client.data.name, client],
]);
