import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const billingCycles = sqliteTable('billing_cycles', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	guildId: text('guild_id').notNull(),
	totalUsdc: integer('total_usdc').notNull(),
	closedAt: integer('closed_at', { mode: 'timestamp_ms' }).notNull(),
	settledAt: integer('settled_at', { mode: 'timestamp_ms' }),
});

export const charges = sqliteTable('charges', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	guildId: text('guild_id').notNull(),
	userId: text('user_id').notNull(),
	billingCycleId: text('billing_cycle_id').references(() => billingCycles.id),
	amountCents: integer('amount_cents').notNull(),
	description: text('description').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const sessions = sqliteTable('sessions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	guildId: text('guild_id').notNull(),
	userId: text('user_id').notNull(),
	billingCycleId: text('billing_cycle_id').references(() => billingCycles.id),
	startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
	stoppedAt: integer('stopped_at', { mode: 'timestamp_ms' }),
	startMessageUrl: text('start_message_url').notNull(),
	stopMessageUrl: text('stop_message_url'),
});
