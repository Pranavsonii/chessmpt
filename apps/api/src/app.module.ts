import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { DbModule } from './db/db.module';
import { GameModule } from './game/game.module';
import { HealthModule } from './health/health.module';
import { MatchmakingModule } from './matchmaking/matchmaking.module';
import { PlayersModule } from './players/players.module';
import { TournamentsModule } from './tournaments/tournaments.module';

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
    EventEmitterModule.forRoot(),
    TournamentsModule,
    PlayersModule,
    MatchmakingModule,
    GameModule,
  ],
})
export class AppModule {}
