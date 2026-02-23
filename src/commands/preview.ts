import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { and, eq, isNull } from 'drizzle-orm';

import { sessions } from '~/db/schema.ts';
import { formatInvoice } from '~/format.ts';
import { db } from '~/db/client.ts';

export const preview = {
	data: new SlashCommandBuilder()
		.setName('preview')
		.setDescription('Preview the current invoice without closing the billing cycle'),

	async execute(interaction: ChatInputCommandInteraction) {
		const guildId = interaction.guildId;
		if (!guildId) {
			await interaction.reply({ content: 'This command can only be used in a server.', flags: 64 });
			return;
		}

		const rows = await db
			.select()
			.from(sessions)
			.where(
				and(
					eq(sessions.guildId, guildId),
					eq(sessions.userId, interaction.user.id),
					isNull(sessions.billingCycleId),
				),
			);

		if (rows.length === 0) {
			await interaction.reply({ content: 'No sessions to invoice.', flags: 64 });
			return;
		}

		await interaction.reply({ content: formatInvoice(rows, new Date()), flags: 64 });
	},
};
