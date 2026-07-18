import { MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';

import { billingCycles } from '~/db/schema.ts';
import { formatInvoices } from '~/format.ts';
import { db } from '~/db/client.ts';

export const invoices = {
	data: new SlashCommandBuilder()
		.setName('invoices')
		.setDescription('List recent invoices and their status')
		.addBooleanOption((opt) =>
			opt.setName('all').setDescription('Include every settled invoice, not just the last 5'),
		),

	async execute(interaction: ChatInputCommandInteraction) {
		const rows = await db.select().from(billingCycles);

		if (rows.length === 0) {
			await interaction.reply({ content: 'No invoices yet.', flags: MessageFlags.Ephemeral });
			return;
		}

		const all = interaction.options.getBoolean('all') ?? false;

		await interaction.reply({
			embeds: [formatInvoices(rows, { settledLimit: all ? undefined : 5 })],
			flags: MessageFlags.Ephemeral,
		});
	},
};
