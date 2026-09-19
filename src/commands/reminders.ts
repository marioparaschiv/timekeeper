import {
	MessageFlags,
	SlashCommandBuilder,
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
} from 'discord.js';
import { and, desc, eq, isNull, like } from 'drizzle-orm';

import { DEFAULT_REMINDER_INTERVAL_MS, nextReminderDue } from '~/reminders.ts';
import { discordTimestamp } from '~/messages.ts';
import { billingCycles } from '~/db/schema.ts';
import { db } from '~/db/client.ts';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const AUTOCOMPLETE_LIMIT = 25;

const labelDateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

function invoiceLabel(cycle: { totalUsdc: number; closedAt: Date }): string {
	return `${cycle.totalUsdc} USDC · ${labelDateFmt.format(cycle.closedAt)}`;
}

async function findOpenCycles(guildId: string, invoiceId: string) {
	return db
		.select()
		.from(billingCycles)
		.where(
			and(
				eq(billingCycles.guildId, guildId),
				like(billingCycles.id, `${invoiceId}%`),
				isNull(billingCycles.settledAt),
			),
		)
		.all();
}

export const reminders = {
	data: new SlashCommandBuilder()
		.setName('reminders')
		.setDescription('Reschedule or pause payment reminders for an open invoice')
		.addSubcommand((sub) =>
			sub
				.setName('pause')
				.setDescription(
					'Pause reminders for an invoice, optionally until a number of days from now',
				)
				.addStringOption((opt) =>
					opt
						.setName('invoice')
						.setDescription('Invoice ID (or its short prefix)')
						.setRequired(true)
						.setAutocomplete(true),
				)
				.addIntegerOption((opt) =>
					opt
						.setName('days')
						.setDescription('Resume after this many days. Omit to pause indefinitely.')
						.setMinValue(1),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName('resume')
				.setDescription('Resume reminders for a paused invoice')
				.addStringOption((opt) =>
					opt
						.setName('invoice')
						.setDescription('Invoice ID (or its short prefix)')
						.setRequired(true)
						.setAutocomplete(true),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName('interval')
				.setDescription('Set how many days between reminders for an invoice')
				.addStringOption((opt) =>
					opt
						.setName('invoice')
						.setDescription('Invoice ID (or its short prefix)')
						.setRequired(true)
						.setAutocomplete(true),
				)
				.addIntegerOption((opt) =>
					opt
						.setName('days')
						.setDescription('Days between reminders. Use 0 to reset to the default.')
						.setRequired(true)
						.setMinValue(0),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName('next')
				.setDescription('Send one reminder in N days, then revert to the normal interval')
				.addStringOption((opt) =>
					opt
						.setName('invoice')
						.setDescription('Invoice ID (or its short prefix)')
						.setRequired(true)
						.setAutocomplete(true),
				)
				.addIntegerOption((opt) =>
					opt
						.setName('days')
						.setDescription('Days from now to send the one-time reminder')
						.setRequired(true)
						.setMinValue(0),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName('status')
				.setDescription('Show when the next reminder fires for an invoice')
				.addStringOption((opt) =>
					opt
						.setName('invoice')
						.setDescription('Invoice ID (or its short prefix)')
						.setRequired(true)
						.setAutocomplete(true),
				),
		),

	async autocomplete(interaction: AutocompleteInteraction) {
		const { guildId } = interaction;
		if (!guildId) {
			await interaction.respond([]);
			return;
		}

		const typed = interaction.options.getFocused().trim().toLowerCase();

		const open = await db
			.select()
			.from(billingCycles)
			.where(and(eq(billingCycles.guildId, guildId), isNull(billingCycles.settledAt)))
			.orderBy(desc(billingCycles.closedAt));

		const choices = open
			.filter((cycle) => {
				if (!typed) return true;
				return (
					cycle.id.toLowerCase().startsWith(typed) ||
					invoiceLabel(cycle).toLowerCase().includes(typed)
				);
			})
			.slice(0, AUTOCOMPLETE_LIMIT)
			.map((cycle) => ({ name: invoiceLabel(cycle), value: cycle.id }));

		await interaction.respond(choices);
	},

	async execute(interaction: ChatInputCommandInteraction) {
		const { guildId } = interaction;

		if (!guildId) {
			await interaction.reply({
				content: 'This command can only be used in a server.',
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const invoiceId = interaction.options.getString('invoice', true).trim();
		const matches = await findOpenCycles(guildId, invoiceId);

		if (matches.length === 0) {
			await interaction.reply({
				content: `No open invoice matches \`${invoiceId}\`. Check \`/invoices\`.`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (matches.length > 1) {
			await interaction.reply({
				content: `\`${invoiceId}\` matches ${matches.length} open invoices. Use more of the ID.`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const cycle = matches[0]!;
		const subcommand = interaction.options.getSubcommand(true);

		if (subcommand === 'pause') {
			const days = interaction.options.getInteger('days');
			const pausedUntil = days ? new Date(Date.now() + days * MS_PER_DAY) : new Date(8.64e15);

			await db
				.update(billingCycles)
				.set({ remindersPausedUntil: pausedUntil })
				.where(eq(billingCycles.id, cycle.id));

			await interaction.reply({
				content: days
					? `Paused reminders for \`${cycle.id.slice(0, 8)}\` until ${discordTimestamp(pausedUntil, 'D')}.`
					: `Paused reminders for \`${cycle.id.slice(0, 8)}\` indefinitely. Run \`/reminders resume\` to restart them.`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (subcommand === 'resume') {
			await db
				.update(billingCycles)
				.set({ remindersPausedUntil: null })
				.where(eq(billingCycles.id, cycle.id));

			await interaction.reply({
				content: `Resumed reminders for \`${cycle.id.slice(0, 8)}\`.`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (subcommand === 'next') {
			const days = interaction.options.getInteger('days', true);
			const nextAt = new Date(Date.now() + days * MS_PER_DAY);

			await db
				.update(billingCycles)
				.set({ nextReminderAt: nextAt, remindersPausedUntil: null })
				.where(eq(billingCycles.id, cycle.id));

			const intervalDays =
				(cycle.reminderIntervalMs ?? DEFAULT_REMINDER_INTERVAL_MS) / MS_PER_DAY;

			await interaction.reply({
				content: `One reminder for \`${cycle.id.slice(0, 8)}\` will fire ${discordTimestamp(nextAt, 'R')}, then reminders return to every ${intervalDays} days.`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (subcommand === 'status') {
			const due = nextReminderDue(cycle);
			const intervalDays =
				(cycle.reminderIntervalMs ?? DEFAULT_REMINDER_INTERVAL_MS) / MS_PER_DAY;
			const isCustomInterval = cycle.reminderIntervalMs !== null;

			const lines = [`Invoice \`${cycle.id.slice(0, 8)}\` · ${cycle.totalUsdc} USDC`];

			if (!due) {
				const until = cycle.remindersPausedUntil!;
				const indefinite = until.getTime() >= 8.64e15;
				lines.push(
					indefinite
						? 'Reminders: **paused indefinitely**'
						: `Reminders: **paused** until ${discordTimestamp(until, 'D')}`,
				);
			} else {
				lines.push(
					`Next reminder: ${discordTimestamp(due, 'f')} (${discordTimestamp(due, 'R')})`,
				);
			}

			if (cycle.nextReminderAt) {
				lines.push(`One-time override active, then reverts to every ${intervalDays} days`);
			} else {
				lines.push(
					`Interval: every ${intervalDays} days${isCustomInterval ? ' (custom)' : ' (default)'}`,
				);
			}

			lines.push(
				cycle.lastReminderAt
					? `Last reminder: ${discordTimestamp(cycle.lastReminderAt, 'R')}`
					: 'No reminder sent yet',
			);

			await interaction.reply({ content: lines.join('\n'), flags: MessageFlags.Ephemeral });
			return;
		}

		const days = interaction.options.getInteger('days', true);
		const intervalMs = days === 0 ? null : days * MS_PER_DAY;

		await db
			.update(billingCycles)
			.set({ reminderIntervalMs: intervalMs })
			.where(eq(billingCycles.id, cycle.id));

		const effectiveDays = (intervalMs ?? DEFAULT_REMINDER_INTERVAL_MS) / MS_PER_DAY;

		await interaction.reply({
			content:
				intervalMs === null
					? `Reset \`${cycle.id.slice(0, 8)}\` to the default reminder interval (${effectiveDays} days).`
					: `Reminders for \`${cycle.id.slice(0, 8)}\` will now fire every ${days} day${days === 1 ? '' : 's'}.`,
			flags: MessageFlags.Ephemeral,
		});
	},
};
