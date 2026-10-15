import { Module } from '@nestjs/common';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';

@Module({
  imports: [TournamentsModule],
  controllers: [PlayersController],
  providers: [PlayersService],
})
export class PlayersModule {}
