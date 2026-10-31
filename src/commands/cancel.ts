import { MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { and, eq, isNull } from 'drizzle-orm';

import { editStartMessage } from '~/messages.ts';
import { sessions } from '~/db/schema.ts';
import { stopTicker } from '~/ticker.ts';
import { db } from '~/db/client.ts';

export const cancel = {
	data: new SlashCommandBuilder()
		.setName('cancel')
		.setDescription('Cancel the active session and delete it without billing'),

	async execute(interaction: ChatInputCommandInteraction) {
		const guildId = interaction.guildId;
		if (!guildId) {
			await interaction.reply({
				content: 'This command can only be used in a server.',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const active = db
			.select()
			.from(sessions)
			.where(
				and(
					eq(sessions.guildId, guildId),
					eq(sessions.userId, interaction.user.id),
					isNull(sessions.stoppedAt),
					isNull(sessions.billingCycleId),
				),
			)
			.get();

		if (!active) {
			await interaction.reply({
				content: 'No active session.',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		stopTicker(active.id);
		db.delete(sessions).where(eq(sessions.id, active.id)).run();

		await interaction.reply({
			content: `[Session cancelled](${active.startMessageUrl}). It will not be billed.`,
		});

		editStartMessage(interaction.client, active.startMessageUrl, 'Session cancelled.');
	},
};
