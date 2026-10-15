import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { AuthUser } from '../auth/auth.types';
import { DB, type Database } from '../db/client';
import {
  matches,
  playerActiveMatch,
  tournaments,
  users,
  type MatchResult,
  type MatchTermination,
} from '../db/schema';
import {
  outcomeFor,
  type Color,
  type Outcome,
} from '../matches/domain/outcome';
import type { TournamentView } from '../tournaments/tournament.view';
import { TournamentsService } from '../tournaments/tournaments.service';

interface PlayerRef {
  id: string;
  name: string;
}

export interface ActiveMatchView {
  matchId: string;
  tournament: { id: string; name: string };
  color: Color;
  opponent: PlayerRef;
  startedAt: string;
}

export interface ScheduleView {
  /** Joined tournaments that are not finished yet, soonest first. */
  tournaments: TournamentView[];
  /** The game this student is playing right now, if any (at most one, by design). */
  activeMatch: ActiveMatchView | null;
}

export interface MatchHistoryItem {
  id: string;
  tournament: { id: string; name: string };
  color: Color;
  opponent: PlayerRef;
  status: 'completed' | 'aborted';
  result: MatchResult | null;
  outcome: Outcome | null; // from this student's point of view; null if aborted
  termination: MatchTermination | null;
  startedAt: string;
  endedAt: string | null;
}

const HISTORY_LIMIT = 100;

@Injectable()
export class PlayersService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly tournaments: TournamentsService,
  ) {}

  async schedule(user: AuthUser): Promise<ScheduleView> {
    const [joined, activeMatch] = await Promise.all([
      this.tournaments.list(user, ['open', 'ongoing'], true),
      this.activeMatch(user.id),
    ]);
    return { tournaments: joined, activeMatch };
  }

  private async activeMatch(userId: string): Promise<ActiveMatchView | null> {
    const white = alias(users, 'white');
    const black = alias(users, 'black');
    const [row] = await this.db
      .select({
        matchId: matches.id,
        tournamentId: tournaments.id,
        tournamentName: tournaments.name,
        whiteId: white.id,
        whiteName: white.name,
        blackId: black.id,
        blackName: black.name,
        startedAt: matches.startedAt,
      })
      .from(playerActiveMatch) // the double-booking lock table doubles as "who is playing now"
      .innerJoin(matches, eq(matches.id, playerActiveMatch.matchId))
      .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
      .innerJoin(white, eq(white.id, matches.whiteId))
      .innerJoin(black, eq(black.id, matches.blackId))
      .where(eq(playerActiveMatch.userId, userId));

    if (!row) return null;
    const color: Color = row.whiteId === userId ? 'white' : 'black';
    return {
      matchId: row.matchId,
      tournament: { id: row.tournamentId, name: row.tournamentName },
      color,
      opponent:
        color === 'white'
          ? { id: row.blackId, name: row.blackName }
          : { id: row.whiteId, name: row.whiteName },
      startedAt: row.startedAt.toISOString(),
    };
  }

  async matchHistory(user: AuthUser): Promise<MatchHistoryItem[]> {
    const white = alias(users, 'white');
    const black = alias(users, 'black');
    const rows = await this.db
      .select({
        m: matches,
        tournamentName: tournaments.name,
        whiteName: white.name,
        blackName: black.name,
      })
      .from(matches)
      .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
      .innerJoin(white, eq(white.id, matches.whiteId))
      .innerJoin(black, eq(black.id, matches.blackId))
      .where(
        and(
          or(eq(matches.whiteId, user.id), eq(matches.blackId, user.id)),
          inArray(matches.status, ['completed', 'aborted']),
        ),
      )
      .orderBy(desc(matches.endedAt), desc(matches.startedAt))
      .limit(HISTORY_LIMIT);

    return rows.map(({ m, tournamentName, whiteName, blackName }) => {
      const color: Color = m.whiteId === user.id ? 'white' : 'black';
      return {
        id: m.id,
        tournament: { id: m.tournamentId, name: tournamentName },
        color,
        opponent:
          color === 'white'
            ? { id: m.blackId, name: blackName }
            : { id: m.whiteId, name: whiteName },
        status: m.status as 'completed' | 'aborted',
        result: m.result,
        outcome: m.result ? outcomeFor(m.result, color) : null,
        termination: m.termination,
        startedAt: m.startedAt.toISOString(),
        endedAt: m.endedAt?.toISOString() ?? null,
      };
    });
  }
}
