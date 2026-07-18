import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { eq } from 'drizzle-orm';

import { billingCycles } from '~/db/schema.ts';
import { db } from '~/db/client.ts';

export const settled = {
	data: new SlashCommandBuilder()
		.setName('settled')
		.setDescription('Mark an invoice as settled')
		.addStringOption((opt) =>
			opt
				.setName('invoice')
				.setDescription('Invoice ID to mark as settled')
				.setRequired(true),
		),

	async execute(interaction: ChatInputCommandInteraction) {
		const invoiceId = interaction.options.getString('invoice', true);

		const cycle = db.select().from(billingCycles).where(eq(billingCycles.id, invoiceId)).get();

		if (!cycle) {
			await interaction.reply({ content: `No invoice with ID \`${invoiceId}\`.`, flags: 64 });
			return;
		}

		if (cycle.settledAt) {
			await interaction.reply({
				content: `Invoice \`${invoiceId}\` was already settled on <t:${Math.floor(cycle.settledAt.getTime() / 1000)}:d>.`,
				flags: 64,
			});
			return;
		}

		const now = new Date();
		await db
			.update(billingCycles)
			.set({ settledAt: now })
			.where(eq(billingCycles.id, invoiceId));

		await interaction.reply({
			content: `Invoice \`${invoiceId}\` (${cycle.totalUsdc} USDC) marked as settled.`,
			flags: 64,
		});
	},
};
