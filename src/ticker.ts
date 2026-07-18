import { and, isNull } from 'drizzle-orm';
import { type Client } from 'discord.js';

import { stopMention } from '~/messages.ts';
import { sessions } from '~/db/schema.ts';
import { db } from '~/db/client.ts';

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;

const FINE_STEP_MS = 5 * SECOND_MS;
const COARSE_STEP_MS = MINUTE_MS;

export function formatElapsed(ms: number): string {
	const totalSeconds = Math.floor(ms / SECOND_MS);

	if (totalSeconds < 60) return `${totalSeconds}s`;

	const totalMinutes = Math.floor(totalSeconds / 60);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;

	if (hours === 0) return `${minutes}m`;

	return `${hours}h${String(minutes).padStart(2, '0')}m`;
}

/**
 * Elapsed time is rendered in 5s steps below a minute and 1m steps above it, so
 * the next edit is due when the elapsed value itself changes rather than one
 * whole step after this tick fired. Scheduling `now + step` instead would drift
 * past the boundary and hold a stale value for most of the following step.
 */
export function msUntilNextTick(elapsedMs: number): number {
	const step = elapsedMs < MINUTE_MS ? FINE_STEP_MS : COARSE_STEP_MS;
	const remainder = elapsedMs % step;
	const untilBoundary = step - remainder;

	if (elapsedMs < MINUTE_MS) {
		return Math.min(untilBoundary, MINUTE_MS - elapsedMs);
	}

	return untilBoundary;
}

const running = new Map<number, NodeJS.Timeout>();

export function stopTicker(sessionId: number) {
	const timer = running.get(sessionId);
	if (!timer) return;

	clearTimeout(timer);
	running.delete(sessionId);
}

export function startTicker(
	client: Client,
	session: { id: number; startedAt: Date; startMessageUrl: string },
	{ editNow = false }: { editNow?: boolean } = {},
) {
	stopTicker(session.id);

	const match = session.startMessageUrl.match(/channels\/(\d+)\/(\d+)\/(\d+)$/);
	if (!match) return;

	const [, guildId, channelId, messageId] = match;

	const edit = async () => {
		const elapsedMs = Date.now() - session.startedAt.getTime();

		const guild = await client.guilds.fetch(guildId!);
		const channel = await guild.channels.fetch(channelId!);
		if (!channel?.isTextBased()) return false;

		const message = await channel.messages.fetch(messageId!);
		await message.edit({
			content: `Session started (Elapsed: ${formatElapsed(elapsedMs)}). Use ${stopMention()} to end it.`,
		});

		return true;
	};

	const tick = async () => {
		try {
			if (!(await edit())) {
				stopTicker(session.id);
				return;
			}
		} catch (error) {
			console.error(`Ticker edit failed for session ${session.id}:`, error);
			stopTicker(session.id);
			return;
		}

		schedule();
	};

	const schedule = () => {
		const elapsedMs = Date.now() - session.startedAt.getTime();
		const timer = setTimeout(() => {
			tick().catch((error) => {
				console.error(`Ticker failed for session ${session.id}:`, error);
				stopTicker(session.id);
			});
		}, msUntilNextTick(elapsedMs));

		timer.unref();
		running.set(session.id, timer);
	};

	if (editNow) {
		tick().catch((error) => {
			console.error(`Ticker catch-up failed for session ${session.id}:`, error);
		});
		return;
	}

	schedule();
}

/**
 * Downtime leaves start messages showing whatever they held when the process
 * died, so each resumed session is edited once up front rather than waiting out
 * the remainder of its current step.
 */
export function resumeTickers(client: Client) {
	const active = db
		.select()
		.from(sessions)
		.where(and(isNull(sessions.stoppedAt), isNull(sessions.billingCycleId)))
		.all();

	for (const session of active) {
		startTicker(client, session, { editNow: true });
	}
}
