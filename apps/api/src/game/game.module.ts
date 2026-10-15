import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MatchmakingModule } from '../matchmaking/matchmaking.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { GameEventsListener } from './game-events.listener';
import { GameBroadcaster } from './game.broadcaster';
import { GameGateway } from './game.gateway';
import { MatchEngine } from './match-engine.service';

@Module({
  // tournaments: who may watch a tournament room; matchmaking: leave the queue on disconnect
  imports: [AuthModule, TournamentsModule, MatchmakingModule],
  providers: [GameGateway, MatchEngine, GameBroadcaster, GameEventsListener],
  exports: [MatchEngine, GameBroadcaster],
})
export class GameModule {}
