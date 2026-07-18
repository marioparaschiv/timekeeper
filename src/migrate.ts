/**
 * Applies pending migrations.
 *
 * drizzle-kit wraps every migration in a transaction, but SQLite ignores
 * `PRAGMA foreign_keys=OFF` inside one. Table rebuilds (any column constraint
 * change) drop a table that other tables reference, so they can only run with
 * foreign keys disabled outside a transaction.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import Database from 'better-sqlite3';

import { env } from '~/env.ts';

const MIGRATIONS_DIR = 'drizzle';

const sqlite = new Database(env.DATABASE_PATH);

sqlite.exec(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
	id SERIAL PRIMARY KEY,
	hash text NOT NULL,
	created_at numeric
)`);

const applied = new Set(
	sqlite
		.prepare('SELECT hash FROM __drizzle_migrations')
		.all()
		.map((row) => (row as { hash: string }).hash),
);

// Ordered by the journal, matching how drizzle-kit resolves migrations.
const journal = JSON.parse(
	readFileSync(join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8'),
) as { entries: { tag: string }[] };

const files = journal.entries.map((entry) => `${entry.tag}.sql`);

let count = 0;

for (const file of files) {
	const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
	const hash = createHash('sha256').update(sql).digest('hex');

	if (applied.has(hash)) continue;

	// Disabled outside the transaction so table rebuilds can drop referenced tables.
	sqlite.pragma('foreign_keys = OFF');

	try {
		sqlite.transaction(() => {
			for (const statement of sql.split('--> statement-breakpoint')) {
				const trimmed = statement.trim();
				if (trimmed) sqlite.exec(trimmed);
			}

			sqlite
				.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)')
				.run(hash, Date.now());
		})();
	} finally {
		sqlite.pragma('foreign_keys = ON');
	}

	const violations = sqlite.pragma('foreign_key_check') as unknown[];
	if (violations.length > 0) {
		throw new Error(`${file} left ${violations.length} foreign key violation(s)`);
	}

	console.log(`applied ${file}`);
	count++;
}

console.log(count === 0 ? 'no pending migrations' : `applied ${count} migration(s)`);
sqlite.close();
