import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GameBroadcaster } from './game.broadcaster';
import { GameGateway } from './game.gateway';
import { MatchEngine } from './match-engine.service';

@Module({
  imports: [AuthModule],
  providers: [GameGateway, MatchEngine, GameBroadcaster],
  // Matchmaking (Phase 8) calls MatchEngine.track() for new matches, and may push via the broadcaster.
  exports: [MatchEngine, GameBroadcaster],
})
export class GameModule {}
