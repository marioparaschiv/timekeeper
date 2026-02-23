import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const billingCycles = sqliteTable('billing_cycles', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	guildId: text('guild_id').notNull(),
	closedAt: integer('closed_at', { mode: 'timestamp_ms' }).notNull(),
});

export const sessions = sqliteTable('sessions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	guildId: text('guild_id').notNull(),
	userId: text('user_id').notNull(),
	billingCycleId: integer('billing_cycle_id').references(() => billingCycles.id),
	startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
	stoppedAt: integer('stopped_at', { mode: 'timestamp_ms' }),
	startMessageUrl: text('start_message_url').notNull(),
	stopMessageUrl: text('stop_message_url'),
});
