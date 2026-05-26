import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { and, eq, isNull } from 'drizzle-orm';

import { discordTimestamp, editStartMessage } from '~/messages.ts';
import { calculateInvoice, formatDuration, formatInvoice } from '~/format.ts';
import { billingCycles, charges, sessions } from '~/db/schema.ts';
import { db } from '~/db/client.ts';

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
			const content = 'Nothing to invoice.';
			if (active) {
				await interaction.followUp({ content, flags: 64 });
			} else {
				await interaction.reply({ content, flags: 64 });
			}
			return;
		}

		const now = new Date();
		const embed = formatInvoice(rows, now, chargeRows);
		const { totalUsdc } = calculateInvoice(rows, now, chargeRows);

		let cycleId!: string;
		await db.transaction(async (tx) => {
			const [cycle] = await tx
				.insert(billingCycles)
				.values({ guildId, totalUsdc, closedAt: now })
				.returning();

			cycleId = cycle!.id;

			if (rows.length > 0) {
				await tx
					.update(sessions)
					.set({ billingCycleId: cycleId })
					.where(
						and(
							eq(sessions.guildId, guildId),
							eq(sessions.userId, userId),
							isNull(sessions.billingCycleId),
						),
					);
			}

			if (chargeRows.length > 0) {
				await tx
					.update(charges)
					.set({ billingCycleId: cycleId })
					.where(
						and(
							eq(charges.guildId, guildId),
							eq(charges.userId, userId),
							isNull(charges.billingCycleId),
						),
					);
			}
		});

		embed.setFooter({ text: `Invoice ID: ${cycleId}` });
		const payload = { embeds: [embed] };
		if (active) {
			await interaction.followUp(payload);
		} else {
			await interaction.reply(payload);
		}
	},
};
