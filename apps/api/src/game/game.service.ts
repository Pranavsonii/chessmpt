import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.types';
import { DB, type Database } from '../db/client';
import { matches, type Match } from '../db/schema';

@Injectable()
export class GameService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Loads a match the user is allowed to follow live: only its two players.
   * Not found and not-yours are separate codes so the UI can say which.
   */
  async getMatchForParticipant(
    matchId: string,
    user: AuthUser,
  ): Promise<Match> {
    const match = await this.db.query.matches.findFirst({
      where: eq(matches.id, matchId),
    });
    if (!match) {
      throw new NotFoundException({
        code: 'MATCH_NOT_FOUND',
        message: 'Match not found',
      });
    }
    if (match.whiteId !== user.id && match.blackId !== user.id) {
      throw new ForbiddenException({
        code: 'NOT_A_PARTICIPANT',
        message: 'You are not playing in this match',
      });
    }
    return match;
  }
}
