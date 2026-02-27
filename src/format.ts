import type { InferSelectModel } from 'drizzle-orm';

import type { charges, sessions } from '~/db/schema.ts';
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
	const totalMs = rows.reduce((sum, s) => sum + (s.stoppedAt?.getTime() ?? now.getTime()) - s.startedAt.getTime(), 0);
	const totalHours = totalMs / 3_600_000;
	const chargeDollars = chargeRows.reduce((sum, c) => sum + c.amountCents, 0) / 100;
	const totalUsdc = Math.ceil(totalHours * env.HOURLY_RATE + chargeDollars);

	return { totalMs, totalUsdc };
}

export function formatInvoice(rows: Session[], now: Date, chargeRows: Charge[] = []): string {
	const { totalMs, totalUsdc } = calculateInvoice(rows, now, chargeRows);

	const lines = rows.map((s) => {
		const ms = (s.stoppedAt?.getTime() ?? now.getTime()) - s.startedAt.getTime();
		return `[${dateFmt.format(s.startedAt)} - ${formatDuration(ms)}](${s.stopMessageUrl ?? s.startMessageUrl})`;
	});

	for (const c of chargeRows) {
		lines.push(`${c.description} — $${(c.amountCents / 100).toFixed(2)}`);
	}

	lines.push(
		'',
		`Total Time: ${formatDuration(totalMs)}`,
		`Invoice Date: ${dateFmt.format(now)}`,
		'',
		`**Total: ${totalUsdc} USDC**`,
		'',
		`**USDC/Solana Address**: ${env.SOLANA_ADDRESS}`,
	);

	return lines.join('\n');
}
