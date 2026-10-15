import { Controller, Get } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { PlayersService } from './players.service';

/** /api/v1/me/* — the logged-in student's own data. (GET /me itself lives in AuthModule.) */
@Roles('student')
@Controller('me')
export class PlayersController {
  constructor(private readonly players: PlayersService) {}

  /** Joined tournaments that haven't finished + the game in progress, if any. */
  @Get('schedule')
  schedule(@CurrentUser() user: AuthUser) {
    return this.players.schedule(user);
  }

  /** Finished games, newest first. */
  @Get('matches')
  matches(@CurrentUser() user: AuthUser) {
    return this.players.matchHistory(user);
  }
}
