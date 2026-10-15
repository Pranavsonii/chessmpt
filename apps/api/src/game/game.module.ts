import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { GameEventsListener } from './game-events.listener';
import { GameBroadcaster } from './game.broadcaster';
import { GameGateway } from './game.gateway';
import { MatchEngine } from './match-engine.service';

@Module({
  imports: [AuthModule, TournamentsModule], // tournaments: who may watch a tournament room
  providers: [GameGateway, MatchEngine, GameBroadcaster, GameEventsListener],
  exports: [MatchEngine, GameBroadcaster],
})
export class GameModule {}
