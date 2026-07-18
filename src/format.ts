import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import type { InferSelectModel } from 'drizzle-orm';

import type { billingCycles, charges, sessions } from '~/db/schema.ts';
import { discordTimestamp } from '~/messages.ts';
import { env } from '~/env.ts';

export function formatDuration(ms: number): string {
	const totalMinutes = Math.ceil(ms / 60_000);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return `${hours}h${String(minutes).padStart(2, '0')}m`;
}

type Session = InferSelectModel<typeof sessions>;
type Charge = InferSelectModel<typeof charges>;

const dateFmt = new Intl.DateTimeFormat('en-GB', {
	day: '2-digit',
	month: '2-digit',
	year: 'numeric',
});

export function calculateInvoice(rows: Session[], now: Date, chargeRows: Charge[] = []) {
	const totalMs = rows.reduce(
		(sum, s) => sum + (s.stoppedAt?.getTime() ?? now.getTime()) - s.startedAt.getTime(),
		0,
	);
	const totalHours = totalMs / 3_600_000;
	const chargeDollars = chargeRows.reduce((sum, c) => sum + c.amountCents, 0) / 100;
	const totalUsdc = Math.ceil(totalHours * env.HOURLY_RATE + chargeDollars);

	return { totalMs, totalUsdc };
}

export const SETTLE_BUTTON_PREFIX = 'settle';

export function settleButton(cycleId: string): ActionRowBuilder<ButtonBuilder> {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`${SETTLE_BUTTON_PREFIX}:${cycleId}`)
			.setLabel('Mark as Settled')
			.setStyle(ButtonStyle.Success),
	);
}

export function settledEmbed(embed: EmbedBuilder, settledAt: Date): EmbedBuilder {
	return EmbedBuilder.from(embed.toJSON())
		.setColor(0x57f287)
		.addFields({ name: 'Settled', value: dateFmt.format(settledAt) });
}

type BillingCycle = InferSelectModel<typeof billingCycles>;

function invoiceLine(cycle: BillingCycle): string {
	const settled = cycle.settledAt ? ` · Settled ${discordTimestamp(cycle.settledAt)}` : '';

	return `[\`${cycle.id.slice(0, 8)}\`](${cycle.invoiceMessageUrl}) · ${cycle.totalUsdc} USDC\nInvoiced ${discordTimestamp(cycle.closedAt)}${settled}`;
}

function total(cycles: BillingCycle[]): number {
	return cycles.reduce((sum, cycle) => sum + cycle.totalUsdc, 0);
}

const DESCRIPTION_LIMIT = 4096;

/**
 * Oldest first, so the most recent invoice sits at the bottom. Anything that
 * would overflow is dropped from the top and summarised there instead.
 */
function invoiceSection(heading: string, cycles: BillingCycle[], budget: number): string {
	const header = `### ${heading} · ${total(cycles)} USDC`;
	const lines = cycles.map(invoiceLine);

	while (lines.length > 0) {
		const omitted = cycles.length - lines.length;
		const notice = omitted > 0 ? `*... ${omitted} older invoice${omitted === 1 ? '' : 's'}*\n\n` : '';
		const section = `${header}\n${notice}${lines.join('\n\n')}`;

		if (section.length <= budget) return section;

		lines.shift();
	}

	return `${header}\n\n*${cycles.length} invoices*`;
}

export function formatInvoices(cycles: BillingCycle[]): EmbedBuilder {
	const ordered = [...cycles].sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime());
	const settled = ordered.filter((cycle) => cycle.settledAt);
	const unsettled = ordered.filter((cycle) => !cycle.settledAt);

	const sections: string[] = [];

	if (settled.length > 0) {
		sections.push(invoiceSection('Settled', settled, DESCRIPTION_LIMIT / 2));
	}

	if (unsettled.length > 0) {
		const used = sections.reduce((sum, section) => sum + section.length, 0);
		sections.push(invoiceSection('Unsettled', unsettled, DESCRIPTION_LIMIT - used - 4));
	}

	return new EmbedBuilder()
		.setTitle(`Invoices · ${cycles.length}`)
		.setColor(0x8ac1ce)
		.setDescription(sections.join('\n'));
}

export function formatInvoice(rows: Session[], now: Date, chargeRows: Charge[] = []): EmbedBuilder {
	const { totalMs, totalUsdc } = calculateInvoice(rows, now, chargeRows);

	const lines = rows.map((s) => {
		const ms = (s.stoppedAt?.getTime() ?? now.getTime()) - s.startedAt.getTime();
		return `[${dateFmt.format(s.startedAt)} - ${formatDuration(ms)}](${s.stopMessageUrl ?? s.startMessageUrl})`;
	});

	if (rows.length > 0 && chargeRows.length > 0) lines.push('');

	for (const c of chargeRows) {
		lines.push(`${c.description} — $${(c.amountCents / 100).toFixed(2)}`);
	}

	const titleDate = dateFmt.format(now);

	return new EmbedBuilder()
		.setTitle(`Invoice - ${titleDate}`)
		.setColor(0x8ac1ce)
		.setDescription(lines.join('\n'))
		.addFields(
			{ name: 'Total Time', value: formatDuration(totalMs), inline: true },
			{ name: 'Total', value: `${totalUsdc} USDC`, inline: true },
			{ name: 'USDC/Solana Address', value: env.SOLANA_ADDRESS },
		);
}
