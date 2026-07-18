import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { desc } from 'drizzle-orm';

import { billingCycles } from '~/db/schema.ts';
import { formatInvoices } from '~/format.ts';
import { db } from '~/db/client.ts';

export const invoices = {
	data: new SlashCommandBuilder()
		.setName('invoices')
		.setDescription('List every invoice and its status'),

	async execute(interaction: ChatInputCommandInteraction) {
		const rows = await db
			.select()
			.from(billingCycles)
			.orderBy(desc(billingCycles.closedAt));

		if (rows.length === 0) {
			await interaction.reply({ content: 'No invoices yet.', flags: 64 });
			return;
		}

		await interaction.reply({ embeds: [formatInvoices(rows)], flags: 64 });
	},
};
