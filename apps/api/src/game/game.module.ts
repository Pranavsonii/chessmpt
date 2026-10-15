import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GameBroadcaster } from './game.broadcaster';
import { GameGateway } from './game.gateway';
import { MatchEngine } from './match-engine.service';
import { MatchFoundListener } from './match-found.listener';

@Module({
  imports: [AuthModule],
  providers: [GameGateway, MatchEngine, GameBroadcaster, MatchFoundListener],
  exports: [MatchEngine, GameBroadcaster],
})
export class GameModule {}
