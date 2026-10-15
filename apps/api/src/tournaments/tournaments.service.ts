import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, eq, inArray, SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { AuthUser } from '../auth/auth.types';
import { DB, type Database } from '../db/client';
import {
  matches,
  tournamentParticipants,
  tournaments,
  users,
  type TournamentStatus,
} from '../db/schema';
import {
  ALLOWED_TRANSITIONS,
  canDelete,
  canEditDetails,
  canEditTimeControl,
  canTransition,
  isVisibleToStudents,
  MIN_PLAYERS_TO_START,
} from './domain/status-machine';
import { parseTimeControl } from './domain/time-control';
import type {
  CreateTournamentDto,
  UpdateTournamentDto,
} from './dto/tournament.dto';
import {
  toTournamentView,
  type ParticipantView,
  type TournamentView,
} from './tournament.view';

const NOT_FOUND = {
  code: 'TOURNAMENT_NOT_FOUND',
  message: 'Tournament not found',
};

@Injectable()
export class TournamentsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  // ------------------------------------------------------------- reads

  /** Tournaments + participant count + winner name in ONE query (no N+1). */
  private async selectViews(where?: SQL): Promise<TournamentView[]> {
    const winner = alias(users, 'winner');
    const participantCount = sql<number>`(
      select count(*)::int from ${tournamentParticipants}
      where ${tournamentParticipants.tournamentId} = ${tournaments.id}
    )`;

    const rows = await this.db
      .select({
        t: tournaments,
        participantCount,
        winnerId: winner.id,
        winnerName: winner.name,
      })
      .from(tournaments)
      .leftJoin(winner, eq(winner.id, tournaments.winnerId))
      .where(where)
      .orderBy(asc(tournaments.startsAt), asc(tournaments.name));

    return rows.map((r) =>
      toTournamentView(
        r.t,
        r.participantCount,
        r.winnerId && r.winnerName
          ? { id: r.winnerId, name: r.winnerName }
          : null,
      ),
    );
  }

  async list(
    user: AuthUser,
    statuses?: TournamentStatus[],
  ): Promise<TournamentView[]> {
    // Students can never list drafts, even if they ask for them.
    const allowed =
      user.role === 'student'
        ? (statuses ?? ['open', 'ongoing', 'completed']).filter(
            isVisibleToStudents,
          )
        : statuses;

    if (allowed && allowed.length === 0) return [];
    return this.selectViews(
      allowed ? inArray(tournaments.status, allowed) : undefined,
    );
  }

  async findOne(user: AuthUser, id: string): Promise<TournamentView> {
    const [view] = await this.selectViews(eq(tournaments.id, id));
    // A draft is invisible to students: answer 404, not 403, so its existence isn't revealed.
    if (
      !view ||
      (user.role === 'student' && !isVisibleToStudents(view.status))
    ) {
      throw new NotFoundException(NOT_FOUND);
    }
    return view;
  }

  async participants(user: AuthUser, id: string): Promise<ParticipantView[]> {
    await this.findOne(user, id); // same visibility rules
    const rows = await this.db
      .select({
        id: users.id,
        name: users.name,
        joinedAt: tournamentParticipants.joinedAt,
      })
      .from(tournamentParticipants)
      .innerJoin(users, eq(users.id, tournamentParticipants.userId))
      .where(eq(tournamentParticipants.tournamentId, id))
      .orderBy(asc(tournamentParticipants.joinedAt));
    return rows.map((r) => ({ ...r, joinedAt: r.joinedAt.toISOString() }));
  }

  // ------------------------------------------------------------- writes (coach)

  async create(
    coachId: string,
    dto: CreateTournamentDto,
  ): Promise<TournamentView> {
    const tc = parseTimeControl(dto.timeControl)!; // DTO already validated it
    const [created] = await this.db
      .insert(tournaments)
      .values({
        name: dto.name,
        ...tc,
        startsAt: new Date(dto.startsAt),
        status: 'draft',
        createdById: coachId,
      })
      .returning({ id: tournaments.id });
    return this.findOneById(created.id);
  }

  async update(id: string, dto: UpdateTournamentDto): Promise<TournamentView> {
    const current = await this.getRow(id);

    if (!canEditDetails(current.status)) {
      throw new ConflictException({
        code: 'TOURNAMENT_COMPLETED',
        message: 'A completed tournament can no longer be edited',
      });
    }
    if (dto.timeControl !== undefined && !canEditTimeControl(current.status)) {
      throw new ConflictException({
        code: 'TIME_CONTROL_LOCKED',
        message:
          'The time control cannot change once the tournament has started',
      });
    }

    const changes = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.startsAt !== undefined && { startsAt: new Date(dto.startsAt) }),
      ...(dto.timeControl !== undefined && parseTimeControl(dto.timeControl)!),
    };
    if (Object.keys(changes).length > 0) {
      await this.db
        .update(tournaments)
        .set(changes)
        .where(eq(tournaments.id, id));
    }
    return this.findOneById(id);
  }

  async changeStatus(
    id: string,
    to: TournamentStatus,
  ): Promise<TournamentView> {
    const current = await this.getRow(id);
    const from = current.status;

    if (!canTransition(from, to)) {
      throw new ConflictException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Cannot change status from ${from} to ${to}`,
        details: { from, to, allowed: ALLOWED_TRANSITIONS[from] },
      });
    }

    if (to === 'ongoing') {
      const [{ n }] = await this.db
        .select({ n: count() })
        .from(tournamentParticipants)
        .where(eq(tournamentParticipants.tournamentId, id));
      if (n < MIN_PLAYERS_TO_START) {
        throw new ConflictException({
          code: 'NOT_ENOUGH_PLAYERS',
          message: `At least ${MIN_PLAYERS_TO_START} students must join before the tournament can start`,
        });
      }
    }

    if (to === 'completed') {
      const [{ n }] = await this.db
        .select({ n: count() })
        .from(matches)
        .where(and(eq(matches.tournamentId, id), eq(matches.status, 'active')));
      if (n > 0) {
        throw new ConflictException({
          code: 'MATCHES_IN_PROGRESS',
          message: `${n} game(s) are still being played. Complete the tournament when they finish.`,
        });
      }
      // Phase 10: compute standings here and store winner_id.
    }

    // Optimistic concurrency: only update if the status is still what we checked.
    // If another request changed it in the meantime, 0 rows match and we report a conflict
    // instead of silently applying a transition that was validated against stale data.
    const updated = await this.db
      .update(tournaments)
      .set({ status: to })
      .where(and(eq(tournaments.id, id), eq(tournaments.status, from)))
      .returning({ id: tournaments.id });
    if (updated.length === 0) {
      throw new ConflictException({
        code: 'STATUS_CHANGED_CONCURRENTLY',
        message:
          'The tournament status was changed by someone else. Refresh and try again.',
      });
    }
    return this.findOneById(id);
  }

  async remove(id: string): Promise<void> {
    const current = await this.getRow(id);
    if (!canDelete(current.status)) {
      throw new ConflictException({
        code: 'TOURNAMENT_NOT_DRAFT',
        message: 'Only draft tournaments can be deleted',
      });
    }
    // Same guard in the WHERE clause, in case it was opened in between.
    const deleted = await this.db
      .delete(tournaments)
      .where(and(eq(tournaments.id, id), eq(tournaments.status, 'draft')))
      .returning({ id: tournaments.id });
    if (deleted.length === 0) {
      throw new ConflictException({
        code: 'TOURNAMENT_NOT_DRAFT',
        message: 'Only draft tournaments can be deleted',
      });
    }
  }

  // ------------------------------------------------------------- helpers

  private async getRow(id: string) {
    const row = await this.db.query.tournaments.findFirst({
      where: eq(tournaments.id, id),
    });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return row;
  }

  private async findOneById(id: string): Promise<TournamentView> {
    const [view] = await this.selectViews(eq(tournaments.id, id));
    if (!view) throw new NotFoundException(NOT_FOUND);
    return view;
  }
}
