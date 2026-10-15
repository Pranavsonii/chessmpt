import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { DbModule } from './db/db.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // apps/api/.env (if any) wins, then the shared root .env
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    DbModule,
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
