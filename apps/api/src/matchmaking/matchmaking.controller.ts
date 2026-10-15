import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { MatchmakingService } from './matchmaking.service';

/**
 * /api/v1/tournaments/:id/queue — the student's place in matchmaking.
 *
 * Joining is REST (standard envelope, error codes, testable with curl). Being
 * matched later is pushed over Socket.IO (`match:found`); GET is the fallback.
 */
@Roles('student')
@Controller('tournaments/:id/queue')
export class MatchmakingController {
  constructor(private readonly matchmaking: MatchmakingService) {}

  /** "Find opponent". 200 with { state: 'searching' | 'matched' }. */
  @Post()
  @HttpCode(200)
  join(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.matchmaking.join(user, id);
  }

  @Get()
  status(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.matchmaking.status(user, id);
  }

  /** "Cancel". 204, idempotent. */
  @Delete()
  @HttpCode(204)
  leave(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    this.matchmaking.leave(user.id, id);
  }
}
