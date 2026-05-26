import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { and, eq, isNull } from 'drizzle-orm';

import { discordTimestamp } from '~/messages.ts';
import { sessions } from '~/db/schema.ts';
import { commandIds } from '~/index.ts';
import { db } from '~/db/client.ts';

function stopMention() {
	const id = commandIds.get('stop');
	return id ? `</stop:${id}>` : '`/stop`';
}

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
			await interaction.reply({
				content: `Session already active (Elapsed: ${discordTimestamp(active.startedAt, 'R')}). Use ${stopMention()} to end it.`,
				flags: 64,
			});
			return;
		}

		const now = new Date();

		const reply = await interaction.reply({
			content: `Session started (Elapsed: ${discordTimestamp(now, 'R')}). Use ${stopMention()} to end it.`,
		});
		const message = await reply.fetch();
		const messageUrl = `https://discord.com/channels/${guildId}/${message.channelId}/${message.id}`;

		await db.insert(sessions).values({
			guildId,
			userId: interaction.user.id,
			startedAt: now,
			startMessageUrl: messageUrl,
		});
	},
};
