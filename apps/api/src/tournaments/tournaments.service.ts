import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUniqueViolation } from '../common/db-errors';
import { checkCanJoin, type JoinDecision } from './domain/join-rules';
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

/** Turns a refused JoinDecision into the matching HTTP exception. */
function httpErrorFor(d: Extract<JoinDecision, { ok: false }>) {
  const body = { code: d.code, message: d.message };
  if (d.status === 403) return new ForbiddenException(body);
  if (d.status === 404) return new NotFoundException(body);
  return new ConflictException(body);
}

@Injectable()
export class TournamentsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  // ------------------------------------------------------------- reads

  /**
   * Tournaments + participant count + winner name in ONE query (no N+1).
   * With a student viewer, also whether that student has joined each one.
   */
  private async selectViews(
    where?: SQL,
    studentId?: string,
  ): Promise<TournamentView[]> {
    const winner = alias(users, 'winner');
    const participantCount = sql<number>`(
      select count(*)::int from ${tournamentParticipants}
      where ${tournamentParticipants.tournamentId} = ${tournaments.id}
    )`;
    const isJoined = studentId
      ? sql<boolean>`exists (
          select 1 from ${tournamentParticipants}
          where ${tournamentParticipants.tournamentId} = ${tournaments.id}
            and ${tournamentParticipants.userId} = ${studentId}
        )`
      : sql<null>`null`;

    const rows = await this.db
      .select({
        t: tournaments,
        participantCount,
        isJoined,
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
        studentId ? Boolean(r.isJoined) : undefined,
      ),
    );
  }

  /** The student's id when the viewer is a student (for isJoined), else undefined. */
  private studentIdOf(user: AuthUser) {
    return user.role === 'student' ? user.id : undefined;
  }

  async list(
    user: AuthUser,
    statuses?: TournamentStatus[],
    joinedOnly = false,
  ): Promise<TournamentView[]> {
    // Students can never list drafts, even if they ask for them.
    const allowed =
      user.role === 'student'
        ? (statuses ?? ['open', 'ongoing', 'completed']).filter(
            isVisibleToStudents,
          )
        : statuses;

    if (allowed && allowed.length === 0) return [];

    const filters: SQL[] = [];
    if (allowed) filters.push(inArray(tournaments.status, allowed));
    if (joinedOnly && user.role === 'student') {
      filters.push(
        sql`exists (
          select 1 from ${tournamentParticipants}
          where ${tournamentParticipants.tournamentId} = ${tournaments.id}
            and ${tournamentParticipants.userId} = ${user.id}
        )`,
      );
    }
    return this.selectViews(and(...filters), this.studentIdOf(user));
  }

  async findOne(user: AuthUser, id: string): Promise<TournamentView> {
    const [view] = await this.selectViews(
      eq(tournaments.id, id),
      this.studentIdOf(user),
    );
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

  // ------------------------------------------------------------- join (student)

  /**
   * POST /tournaments/:id/join
   *
   * Runs in a transaction that reads the tournament with SELECT ... FOR SHARE.
   * That row lock makes a concurrent status change (e.g. the coach clicking "Start")
   * wait until this join commits, so a student can never slip in after registration
   * closed. The composite primary key on tournament_participants is the final guard
   * against a double join (two fast clicks).
   */
  async join(user: AuthUser, id: string): Promise<TournamentView> {
    await this.db.transaction(async (tx) => {
      const [t] = await tx
        .select({ status: tournaments.status })
        .from(tournaments)
        .where(eq(tournaments.id, id))
        .for('share');
      if (!t) throw new NotFoundException(NOT_FOUND);

      const existing = await tx
        .select({ userId: tournamentParticipants.userId })
        .from(tournamentParticipants)
        .where(
          and(
            eq(tournamentParticipants.tournamentId, id),
            eq(tournamentParticipants.userId, user.id),
          ),
        );

      const decision = checkCanJoin({
        role: user.role,
        status: t.status,
        alreadyJoined: existing.length > 0,
      });
      if (!decision.ok) throw httpErrorFor(decision);

      try {
        await tx
          .insert(tournamentParticipants)
          .values({ tournamentId: id, userId: user.id });
      } catch (err) {
        // Two requests passed the check at the same time; the primary key caught the second.
        if (isUniqueViolation(err)) {
          throw new ConflictException({
            code: 'ALREADY_JOINED',
            message: 'You have already joined this tournament',
          });
        }
        throw err;
      }
    });

    return this.findOne(user, id);
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
