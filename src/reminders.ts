import { type InferSelectModel, isNull, eq } from 'drizzle-orm';
import { type Client } from 'discord.js';

import { billingCycles, guildClients } from '~/db/schema.ts';
import { db } from '~/db/client.ts';

export const DEFAULT_REMINDER_INTERVAL_MS = 5 * 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

type BillingCycle = InferSelectModel<typeof billingCycles>;

/**
 * When the next reminder for an open cycle is due, or null while paused. A
 * one-off nextReminderAt override wins over the recurring interval.
 */
export function nextReminderDue(cycle: BillingCycle): Date | null {
	if (cycle.remindersPausedUntil && cycle.remindersPausedUntil.getTime() > Date.now())
		return null;

	if (cycle.nextReminderAt) return cycle.nextReminderAt;

	const interval = cycle.reminderIntervalMs ?? DEFAULT_REMINDER_INTERVAL_MS;
	return new Date((cycle.lastReminderAt ?? cycle.closedAt).getTime() + interval);
}

function nudge(invoiceMessageUrl: string, totalUsdc: number, clientUserId?: string) {
	const reminder = `Reminder: [this invoice](${invoiceMessageUrl}) for ${totalUsdc} USDC is still outstanding. Payment details are in the invoice above.`;

	return clientUserId ? `<@${clientUserId}> ${reminder}` : reminder;
}

async function sendDueReminders(client: Client) {
	const [open, clients] = await Promise.all([
		db.select().from(billingCycles).where(isNull(billingCycles.settledAt)),
		db.select().from(guildClients),
	]);

	const clientByGuild = new Map(clients.map(({ guildId, userId }) => [guildId, userId]));

	const now = Date.now();

	for (const cycle of open) {
		const due = nextReminderDue(cycle);
		if (!due || due.getTime() > now) continue;

		const match = cycle.invoiceMessageUrl.match(/channels\/(\d+)\/(\d+)\/(\d+)$/);
		if (!match) continue;

		const [, guildId, channelId] = match;

		try {
			const guild = await client.guilds.fetch(guildId!);
			const channel = await guild.channels.fetch(channelId!);
			if (!channel?.isTextBased() || !channel.isSendable()) continue;

			const clientUserId = clientByGuild.get(cycle.guildId);

			await channel.send({
				content: nudge(cycle.invoiceMessageUrl, cycle.totalUsdc, clientUserId),
				allowedMentions: { users: clientUserId ? [clientUserId] : [] },
			});

			await db
				.update(billingCycles)
				.set({ lastReminderAt: new Date(now), nextReminderAt: null })
				.where(eq(billingCycles.id, cycle.id));
		} catch (error) {
			console.error(`Failed to send reminder for invoice ${cycle.id}:`, error);
		}
	}
}

export function startReminders(client: Client) {
	const run = () => {
		sendDueReminders(client).catch((error) => {
			console.error('Reminder sweep failed:', error);
		});
	};

	run();
	setInterval(run, CHECK_INTERVAL_MS).unref();
}
