import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { isNull } from 'drizzle-orm';

import { billingCycles } from '~/db/schema.ts';
import { db } from '~/db/client.ts';

export const pending = {
	data: new SlashCommandBuilder()
		.setName('pending-invoices')
		.setDescription('List all unsettled invoices'),

	async execute(interaction: ChatInputCommandInteraction) {
		const rows = await db.select().from(billingCycles).where(isNull(billingCycles.settledAt));

		if (rows.length === 0) {
			await interaction.reply({ content: 'No pending invoices.', flags: 64 });
			return;
		}

		const list = rows
			.map(
				(r) =>
					`[\`${r.id}\`](${r.invoiceMessageUrl}) — ${r.totalUsdc} USDC — <t:${Math.floor(r.closedAt.getTime() / 1000)}:R>`,
			)
			.join('\n');

		await interaction.reply({ content: list, flags: 64 });
	},
};
