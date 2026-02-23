import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { and, eq, isNull } from 'drizzle-orm';

import { sessions } from '~/db/schema.ts';
import { db } from '~/db/client.ts';

export const start = {
	data: new SlashCommandBuilder().setName('start').setDescription('Start a billing session'),

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

		if (active) {
			const time = new Intl.DateTimeFormat('en-GB', {
				dateStyle: 'short',
				timeStyle: 'short',
			}).format(active.startedAt);
			await interaction.reply({
				content: `Session already active since ${time}.`,
				flags: 64,
			});
			return;
		}

		const reply = await interaction.reply({ content: 'Session started.' });
		const message = await reply.fetch();
		const messageUrl = `https://discord.com/channels/${guildId}/${message.channelId}/${message.id}`;

		await db.insert(sessions).values({
			guildId,
			userId: interaction.user.id,
			startedAt: new Date(),
			startMessageUrl: messageUrl,
		});
	},
};
