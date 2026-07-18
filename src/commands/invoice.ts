import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { and, eq, isNull } from 'drizzle-orm';

import { calculateInvoice, formatDuration, formatInvoice, settleButton } from '~/format.ts';
import { discordTimestamp, editStartMessage } from '~/messages.ts';
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
		const active = db
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

		const cycleId = crypto.randomUUID();
		embed.setFooter({ text: `Invoice ID: ${cycleId}` });

		const payload = { embeds: [embed], components: [settleButton(cycleId)] };
		const invoiceMessage = active
			? await interaction.followUp(payload)
			: await (await interaction.reply(payload)).fetch();

		const invoiceMessageUrl = `https://discord.com/channels/${guildId}/${invoiceMessage.channelId}/${invoiceMessage.id}`;

		db.transaction((tx) => {
			tx.insert(billingCycles)
				.values({ id: cycleId, guildId, totalUsdc, closedAt: now, invoiceMessageUrl })
				.run();

			if (rows.length > 0) {
				tx.update(sessions)
					.set({ billingCycleId: cycleId })
					.where(
						and(
							eq(sessions.guildId, guildId),
							eq(sessions.userId, userId),
							isNull(sessions.billingCycleId),
						),
					)
					.run();
			}

			if (chargeRows.length > 0) {
				tx.update(charges)
					.set({ billingCycleId: cycleId })
					.where(
						and(
							eq(charges.guildId, guildId),
							eq(charges.userId, userId),
							isNull(charges.billingCycleId),
						),
					)
					.run();
			}
		});
	},
};
