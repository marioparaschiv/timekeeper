import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { and, eq, isNull } from 'drizzle-orm';

import { billingCycles, sessions } from '~/db/schema.ts';
import { formatDuration } from '~/format.ts';
import { db } from '~/db/client.ts';
import { env } from '~/env.ts';

const dateFmt = new Intl.DateTimeFormat('en-GB', {
	day: '2-digit',
	month: '2-digit',
	year: 'numeric',
});

export const invoice = {
	data: new SlashCommandBuilder()
		.setName('invoice')
		.setDescription('Close the current billing cycle and post an invoice'),

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

		const active = await db
			.select()
			.from(sessions)
			.where(
				and(
					eq(sessions.guildId, guildId),
					eq(sessions.userId, userId),
					isNull(sessions.stoppedAt),
					isNull(sessions.billingCycleId),
				),
			)
			.get();

		if (active) {
			const now = new Date();
			const reply = await interaction.reply({
				content: `Session stopped. Duration: ${formatDuration(now.getTime() - active.startedAt.getTime())}`,
			});
			const message = await reply.fetch();
			const messageUrl = `https://discord.com/channels/${guildId}/${message.channelId}/${message.id}`;

			await db
				.update(sessions)
				.set({ stoppedAt: now, stopMessageUrl: messageUrl })
				.where(eq(sessions.id, active.id));
		}

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

		if (rows.length === 0) {
			const content = 'No sessions to invoice.';
			if (active) {
				await interaction.followUp({ content, flags: 64 });
			} else {
				await interaction.reply({ content, flags: 64 });
			}
			return;
		}

		const now = new Date();

		await db.transaction(async (tx) => {
			const [cycle] = await tx
				.insert(billingCycles)
				.values({ guildId, closedAt: now })
				.returning();

			await tx
				.update(sessions)
				.set({ billingCycleId: cycle!.id })
				.where(
					and(
						eq(sessions.guildId, guildId),
						eq(sessions.userId, userId),
						isNull(sessions.billingCycleId),
					),
				);
		});

		let totalMs = 0;
		const lines = rows.map((s) => {
			const ms = (s.stoppedAt?.getTime() ?? now.getTime()) - s.startedAt.getTime();
			totalMs += ms;
			return `[${dateFmt.format(s.startedAt)} - ${formatDuration(ms)}](${s.stopMessageUrl ?? s.startMessageUrl})`;
		});

		const totalHours = totalMs / 3_600_000;
		const totalUsdc = Math.ceil(totalHours * env.HOURLY_RATE);

		lines.push(
			'',
			`Total Time: ${formatDuration(totalMs)}`,
			`Invoice Date: ${dateFmt.format(new Date())}`,
			'',
			`**Total: ${totalUsdc} USDC**`,
			'',
			`**USDC/Solana Address**: ${env.SOLANA_ADDRESS}`,
		);

		const content = lines.join('\n');
		if (active) {
			await interaction.followUp({ content });
		} else {
			await interaction.reply({ content });
		}
	},
};
