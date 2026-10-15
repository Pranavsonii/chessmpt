import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import type { EnvironmentVariables } from '../config/env.validation';
import { createDb, createPool, DB, PG_POOL } from './client';

/**
 * Makes the typed Drizzle client injectable everywhere:
 *   constructor(@Inject(DB) private readonly db: Database) {}
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        createPool(config.get('DATABASE_URL', { infer: true })),
    },
    {
      provide: DB,
      inject: [PG_POOL],
      useFactory: createDb,
    },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Close all connections on shutdown so the process can exit cleanly. */
  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
