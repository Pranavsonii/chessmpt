import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { GameBroadcaster } from './game.broadcaster';
import { GameGateway } from './game.gateway';
import { MatchEngine } from './match-engine.service';
import { MatchFoundListener } from './match-found.listener';
import { TournamentUpdatesListener } from './tournament-updates.listener';

@Module({
  imports: [AuthModule, TournamentsModule],
  providers: [
    GameGateway,
    MatchEngine,
    GameBroadcaster,
    MatchFoundListener,
    TournamentUpdatesListener,
  ],
  exports: [MatchEngine, GameBroadcaster],
})
export class GameModule {}
