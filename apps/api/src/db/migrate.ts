import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb, createPool } from './client';
import { loadEnv, requireDatabaseUrl } from './load-env';

/**
 * Applies the committed SQL migrations in apps/api/drizzle/ in order.
 * Drizzle records applied ones in drizzle.__drizzle_migrations, so re-running is a no-op.
 */
async function main() {
  loadEnv();
  const pool = createPool(requireDatabaseUrl());
  try {
    // Works from src/db (tsx) and dist/db (compiled): both are two levels below apps/api.
    await migrate(createDb(pool), {
      migrationsFolder: resolve(__dirname, '../../drizzle'),
    });
    console.log('✔ Migrations applied');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('✖ Migration failed:', err);
  process.exit(1);
});
