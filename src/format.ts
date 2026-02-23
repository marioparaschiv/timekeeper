import type { InferSelectModel } from 'drizzle-orm';

import type { sessions } from '~/db/schema.ts';
import { env } from '~/env.ts';

export function formatDuration(ms: number): string {
	const totalMinutes = Math.floor(ms / 60_000);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return `${hours}h${String(minutes).padStart(2, '0')}m`;
}

type Session = InferSelectModel<typeof sessions>;

const dateFmt = new Intl.DateTimeFormat('en-GB', {
	day: '2-digit',
	month: '2-digit',
	year: 'numeric',
});

export function formatInvoice(rows: Session[], now: Date): string {
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
		`Invoice Date: ${dateFmt.format(now)}`,
		'',
		`**Total: ${totalUsdc} USDC**`,
		'',
		`**USDC/Solana Address**: ${env.SOLANA_ADDRESS}`,
	);

	return lines.join('\n');
}
