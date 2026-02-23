import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';

import * as schema from '~/db/schema';

const sqlite = new Database('timekeeper.db');
sqlite.run('PRAGMA journal_mode = WAL;');
sqlite.run('PRAGMA foreign_keys = ON;');

export const db = drizzle({ client: sqlite, schema });
