import { defineConfig } from 'drizzle-kit';
import { loadEnv, requireDatabaseUrl } from './src/db/load-env';

loadEnv();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle', // generated SQL migrations, committed to git
  dbCredentials: { url: requireDatabaseUrl() },
  strict: true,
  verbose: true,
});
