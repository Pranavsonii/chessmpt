import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * For standalone scripts (migrate, seed, drizzle-kit) that run outside Nest's ConfigModule.
 * Loads apps/api/.env and then the root .env; variables already set (e.g. by Docker) win.
 */
export function loadEnv(): void {
  const apiRoot = resolve(__dirname, '../..');
  for (const file of [
    resolve(apiRoot, '.env'),
    resolve(apiRoot, '../../.env'),
  ]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (see .env.example)');
  return url;
}
