import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

/** Injection tokens for the Drizzle client and the underlying pg pool. */
export const DB = Symbol('DB');
export const PG_POOL = Symbol('PG_POOL');

export function createPool(connectionString: string): Pool {
  // The pool connects lazily: no connection is opened until the first query.
  return new Pool({ connectionString, max: 10 });
}

export function createDb(pool: Pool): Database {
  return drizzle(pool, { schema });
}
