import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { and, eq, isNull } from 'drizzle-orm';

import { formatInvoice } from '~/format.ts';
import { charges, sessions } from '~/db/schema.ts';
import { db } from '~/db/client.ts';

export const preview = {
	data: new SlashCommandBuilder()
		.setName('preview')
		.setDescription('Preview the current invoice without closing the billing cycle'),

	async execute(interaction: ChatInputCommandInteraction) {
		const guildId = interaction.guildId;
		if (!guildId) {
			await interaction.reply({
				content: 'This command can only be used in a server.',
				flags: 64,
			});
			return;
		}

		const userId = interaction.user.id;

		const rows = await db
			.select()
			.from(sessions)
			.where(
				and(
					eq(sessions.guildId, guildId),
					eq(sessions.userId, userId),
					isNull(sessions.billingCycleId),
				),
			);

		const chargeRows = await db
			.select()
			.from(charges)
			.where(
				and(
					eq(charges.guildId, guildId),
					eq(charges.userId, userId),
					isNull(charges.billingCycleId),
				),
			);

		if (rows.length === 0 && chargeRows.length === 0) {
			await interaction.reply({ content: 'Nothing to invoice.', flags: 64 });
			return;
		}

		const content = formatInvoice(rows, new Date(), chargeRows);
		await interaction.reply({ content, flags: 64 });
	},
};
