import { MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { and, eq, isNull } from 'drizzle-orm';

import { formatElapsed, startTicker } from '~/ticker.ts';
import { stopMention } from '~/messages.ts';
import { sessions } from '~/db/schema.ts';
import { db } from '~/db/client.ts';

export const start = {
	data: new SlashCommandBuilder().setName('start').setDescription('Start a billing session'),

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

		if (active) {
			await interaction.reply({
				content: `Session already active. Use ${stopMention(guildId)} to end it.`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const now = new Date();

		const reply = await interaction.reply({
			content: `Session started (Elapsed: ${formatElapsed(0)}). Use ${stopMention(guildId)} to end it.`,
		});
		const message = await reply.fetch();
		const messageUrl = `https://discord.com/channels/${guildId}/${message.channelId}/${message.id}`;

		const inserted = db
			.insert(sessions)
			.values({
				guildId,
				userId: interaction.user.id,
				startedAt: now,
				startMessageUrl: messageUrl,
			})
			.returning()
			.get();

		startTicker(interaction.client, inserted);
	},
};
