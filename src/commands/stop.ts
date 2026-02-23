import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { and, eq, isNull } from 'drizzle-orm';

import { discordTimestamp, editStartMessage } from '~/messages.ts';
import { formatDuration } from '~/format.ts';
import { sessions } from '~/db/schema.ts';
import { db } from '~/db/client.ts';

export const stop = {
	data: new SlashCommandBuilder()
		.setName('stop')
		.setDescription('Stop the active billing session'),

	async execute(interaction: ChatInputCommandInteraction) {
		const guildId = interaction.guildId;
		if (!guildId) {
			await interaction.reply({
				content: 'This command can only be used in a server.',
				flags: 64,
			});
			return;
		}

		const active = await db
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
			await interaction.reply({ content: 'No active session.', flags: 64 });
			return;
		}

		const now = new Date();
		const duration = formatDuration(now.getTime() - active.startedAt.getTime());

		const reply = await interaction.reply({
			content: `[Session stopped](${active.startMessageUrl}). ${discordTimestamp(active.startedAt, 't')} - ${discordTimestamp(now, 't')} (${duration})`,
		});
		const message = await reply.fetch();
		const stopMessageUrl = `https://discord.com/channels/${guildId}/${message.channelId}/${message.id}`;

		await db
			.update(sessions)
			.set({ stoppedAt: now, stopMessageUrl })
			.where(eq(sessions.id, active.id));

		editStartMessage(interaction.client, active.startMessageUrl);
	},
};
