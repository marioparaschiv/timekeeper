import { type Client } from 'discord.js';
import { isNull, eq } from 'drizzle-orm';

import { billingCycles } from '~/db/schema.ts';
import { db } from '~/db/client.ts';

const REMINDER_INTERVAL_MS = 5 * 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

function nudge(cycleId: string, invoiceMessageUrl: string) {
	return `Just floating this back up — [the invoice from earlier](${invoiceMessageUrl}) is still open on my end. No rush at all, and if it's already handled or something needs changing, let me know and I'll sort it. Invoice \`${cycleId}\`.`;
}

async function sendDueReminders(client: Client) {
	const open = await db.select().from(billingCycles).where(isNull(billingCycles.settledAt));

	const now = Date.now();

	for (const cycle of open) {
		const since = (cycle.lastReminderAt ?? cycle.closedAt).getTime();
		if (now - since < REMINDER_INTERVAL_MS) continue;

		const match = cycle.invoiceMessageUrl.match(/channels\/(\d+)\/(\d+)\/(\d+)$/);
		if (!match) continue;

		const [, guildId, channelId] = match;

		try {
			const guild = await client.guilds.fetch(guildId!);
			const channel = await guild.channels.fetch(channelId!);
			if (!channel?.isTextBased() || !channel.isSendable()) continue;

			await channel.send({ content: nudge(cycle.id, cycle.invoiceMessageUrl) });

			await db
				.update(billingCycles)
				.set({ lastReminderAt: new Date(now) })
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
