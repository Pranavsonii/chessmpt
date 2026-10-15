import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { and, eq, inArray } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.types';
import { isUniqueViolation } from '../common/db-errors';
import {
  Events,
  type MatchFoundEvent,
  type TournamentStatusChangedEvent,
} from '../common/events';
import { DB, type Database } from '../db/client';
import {
  matches,
  playerActiveMatch,
  tournamentParticipants,
  tournaments,
  users,
} from '../db/schema';
import {
  assignColors,
  pairKey,
  pickPair,
  type QueueEntry,
} from './domain/pairing';
import { checkCanQueue, type QueueDecision } from './domain/queue-rules';

export type QueueStatus =
  | { state: 'idle' }
  | { state: 'searching'; tournamentId: string; since: string; waiting: number }
  | { state: 'matched'; tournamentId: string; matchId: string };

/** Re-check every queue this often, so "rematch after 15s of waiting" happens even if nobody new joins. */
const SWEEP_INTERVAL_MS = 5_000;

/** Thrown inside the match transaction when the tournament stopped being ongoing. */
class TournamentClosedError extends Error {}

/**
 * The matchmaking queue.
 *
 * State lives in memory: one API process, classroom scale. It's lost on restart
 * (players just click "Find opponent" again). Several API instances would need the
 * queue in Redis or Postgres instead.
 *
 * Correctness does NOT depend on the memory state alone: the player_active_match
 * primary key in Postgres is the final guarantee that nobody is in two games.
 */
@Injectable()
export class MatchmakingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchmakingService.name);

  /** tournamentId → players waiting in that tournament. */
  private readonly queues = new Map<string, QueueEntry[]>();
  /** userId → the one tournament they're queued in (a player waits in one queue at a time). */
  private readonly queuedIn = new Map<string, string>();
  /** The pairing run in progress per tournament (at most one at a time). */
  private readonly pairingRuns = new Map<string, Promise<void>>();
  private sweepTimer?: NodeJS.Timeout;

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit() {
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    this.sweepTimer.unref(); // never keep the process alive just for this
  }

  onModuleDestroy() {
    clearInterval(this.sweepTimer);
  }

  // ------------------------------------------------------------- public API

  /** "Find opponent": enter the queue, and get paired immediately if someone is waiting. */
  async join(user: AuthUser, tournamentId: string): Promise<QueueStatus> {
    const decision = await this.checkPreconditions(user.id, tournamentId);
    if (!decision.ok) throw httpErrorFor(decision);

    if (this.queuedIn.get(user.id) !== tournamentId) {
      this.removeFromQueue(user.id); // leave any other tournament's queue first
      this.addToQueue(user.id, tournamentId);
      this.logger.log(
        `queue+ ${tournamentId.slice(0, 8)} user ${user.id.slice(0, 8)}`,
      );
    }

    await this.tryPair(tournamentId);
    return this.status(user, tournamentId);
  }

  /** "Cancel": idempotent, leaving a queue you're not in is fine. */
  leave(userId: string, tournamentId: string): void {
    if (this.queuedIn.get(userId) === tournamentId)
      this.removeFromQueue(userId);
  }

  /** For the Socket.IO gateway (Phase 7): a player's last connection closed. */
  leaveAll(userId: string): void {
    this.removeFromQueue(userId);
  }

  async status(user: AuthUser, tournamentId: string): Promise<QueueStatus> {
    const active = await this.activeMatchOf(user.id);
    if (active) {
      return {
        state: 'matched',
        tournamentId: active.tournamentId,
        matchId: active.matchId,
      };
    }
    if (this.queuedIn.get(user.id) === tournamentId) {
      const queue = this.queues.get(tournamentId) ?? [];
      const me = queue.find((e) => e.userId === user.id)!;
      return {
        state: 'searching',
        tournamentId,
        since: new Date(me.joinedAt).toISOString(),
        waiting: queue.length,
      };
    }
    return { state: 'idle' };
  }

  /** A tournament that stops being ongoing can't pair anyone: empty its queue. */
  @OnEvent(Events.TournamentStatusChanged)
  onTournamentStatusChanged(e: TournamentStatusChangedEvent) {
    if (e.to !== 'ongoing') this.clearQueue(e.tournamentId);
  }

  // ------------------------------------------------------------- pairing

  /**
   * Pair as many players as possible in one tournament.
   *
   * Concurrency: Node runs one piece of JS at a time. Between two `await`s nothing
   * else can touch the queue, so "pick a pair + remove both from the queue" is done
   * synchronously, with no await in between. Two pairing runs can therefore never
   * pick the same player.
   *
   * Only one run per tournament at a time. A join that arrives mid-run doesn't start
   * a second run: it waits for the current one, which re-reads the queue each round
   * and so pairs the newcomer too. Waiting (rather than returning straight away) means
   * the newcomer's response already says "matched" when they were paired in that run.
   */
  private tryPair(tournamentId: string): Promise<void> {
    const running = this.pairingRuns.get(tournamentId);
    if (running) return running;

    const run = this.pairLoop(tournamentId).finally(() =>
      this.pairingRuns.delete(tournamentId),
    );
    this.pairingRuns.set(tournamentId, run);
    return run;
  }

  private async pairLoop(tournamentId: string): Promise<void> {
    for (;;) {
      if ((this.queues.get(tournamentId)?.length ?? 0) < 2) return;
      const { played, whiteCounts } = await this.history(tournamentId);

      // ---- synchronous section: pick + remove, no await ----
      const pair = pickPair(
        this.queues.get(tournamentId) ?? [],
        played,
        Date.now(),
      );
      if (!pair) return;
      const [a, b] = pair;
      this.removeFromQueue(a.userId);
      this.removeFromQueue(b.userId);
      // -------------------------------------------------------

      try {
        await this.createMatch(tournamentId, a, b, whiteCounts);
      } catch (err) {
        if (err instanceof TournamentClosedError) {
          this.clearQueue(tournamentId);
          return;
        }
        if (isUniqueViolation(err)) {
          // One of them got into a game some other way. Put back whoever is still free.
          await this.requeueIfFree(tournamentId, [a, b]);
          continue;
        }
        this.logger.error('Failed to create match', err as Error);
        this.requeue(tournamentId, [a, b]);
        return;
      }
    }
  }

  private sweep() {
    for (const [tournamentId, queue] of this.queues) {
      if (queue.length >= 2) void this.tryPair(tournamentId);
    }
  }

  /**
   * Create the match and lock both players, in ONE transaction:
   *  - the tournament row is read FOR SHARE, so it can't be completed mid-way;
   *  - inserting both player_active_match rows fails with a unique violation if
   *    either player is already in a game (primary key = user_id).
   * Either everything is written, or nothing is.
   */
  private async createMatch(
    tournamentId: string,
    a: QueueEntry,
    b: QueueEntry,
    whiteCounts: Map<string, number>,
  ): Promise<void> {
    const { whiteId, blackId } = assignColors(a.userId, b.userId, whiteCounts);

    const match = await this.db.transaction(async (tx) => {
      const [t] = await tx
        .select({
          status: tournaments.status,
          name: tournaments.name,
          initialSeconds: tournaments.initialSeconds,
          incrementSeconds: tournaments.incrementSeconds,
        })
        .from(tournaments)
        .where(eq(tournaments.id, tournamentId))
        .for('share');
      if (!t || t.status !== 'ongoing') throw new TournamentClosedError();

      const clockMs = t.initialSeconds * 1000;
      const [m] = await tx
        .insert(matches)
        .values({
          tournamentId,
          whiteId,
          blackId,
          incrementMs: t.incrementSeconds * 1000,
          whiteMs: clockMs,
          blackMs: clockMs,
          // turnStartedAt stays null: the clock rules (Phase 9) decide when it starts.
        })
        .returning({ id: matches.id });

      await tx.insert(playerActiveMatch).values([
        { userId: whiteId, matchId: m.id },
        { userId: blackId, matchId: m.id },
      ]);
      return { id: m.id, tournamentName: t.name };
    });

    const names = await this.db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, [whiteId, blackId]));
    const nameOf = (id: string) =>
      names.find((u) => u.id === id)?.name ?? 'Player';

    const event: MatchFoundEvent = {
      matchId: match.id,
      tournamentId,
      tournamentName: match.tournamentName,
      white: { id: whiteId, name: nameOf(whiteId) },
      black: { id: blackId, name: nameOf(blackId) },
    };
    this.logger.log(
      `match ${match.id.slice(0, 8)}: ${event.white.name} (white) vs ${event.black.name} (black)`,
    );
    this.events.emit(Events.MatchFound, event);
  }

  /** Who already played whom in this tournament, and how often each played white. */
  private async history(tournamentId: string) {
    const rows = await this.db
      .select({ whiteId: matches.whiteId, blackId: matches.blackId })
      .from(matches)
      .where(
        and(
          eq(matches.tournamentId, tournamentId),
          eq(matches.status, 'completed'),
        ),
      );

    const played = new Set<string>();
    const whiteCounts = new Map<string, number>();
    for (const r of rows) {
      played.add(pairKey(r.whiteId, r.blackId));
      whiteCounts.set(r.whiteId, (whiteCounts.get(r.whiteId) ?? 0) + 1);
    }
    return { played, whiteCounts };
  }

  // ------------------------------------------------------------- preconditions

  private async checkPreconditions(
    userId: string,
    tournamentId: string,
  ): Promise<QueueDecision> {
    const [t] = await this.db
      .select({ status: tournaments.status })
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId));
    if (!t) {
      return {
        ok: false,
        status: 404,
        code: 'TOURNAMENT_NOT_FOUND',
        message: 'Tournament not found',
      };
    }

    const [participant, active] = await Promise.all([
      this.db
        .select({ userId: tournamentParticipants.userId })
        .from(tournamentParticipants)
        .where(
          and(
            eq(tournamentParticipants.tournamentId, tournamentId),
            eq(tournamentParticipants.userId, userId),
          ),
        ),
      this.activeMatchOf(userId),
    ]);

    return checkCanQueue({
      status: t.status,
      isParticipant: participant.length > 0,
      activeMatchId: active?.matchId ?? null,
    });
  }

  private async activeMatchOf(userId: string) {
    const [row] = await this.db
      .select({
        matchId: playerActiveMatch.matchId,
        tournamentId: matches.tournamentId,
      })
      .from(playerActiveMatch)
      .innerJoin(matches, eq(matches.id, playerActiveMatch.matchId))
      .where(eq(playerActiveMatch.userId, userId));
    return row ?? null;
  }

  // ------------------------------------------------------------- queue bookkeeping

  private addToQueue(
    userId: string,
    tournamentId: string,
    joinedAt = Date.now(),
  ) {
    const queue = this.queues.get(tournamentId) ?? [];
    queue.push({ userId, joinedAt });
    this.queues.set(tournamentId, queue);
    this.queuedIn.set(userId, tournamentId);
  }

  private removeFromQueue(userId: string) {
    const tournamentId = this.queuedIn.get(userId);
    if (!tournamentId) return;
    this.queuedIn.delete(userId);
    const rest = (this.queues.get(tournamentId) ?? []).filter(
      (e) => e.userId !== userId,
    );
    if (rest.length) this.queues.set(tournamentId, rest);
    else this.queues.delete(tournamentId);
  }

  /** Put players back, keeping their original place in line (joinedAt). */
  private requeue(tournamentId: string, entries: QueueEntry[]) {
    for (const e of entries) {
      if (!this.queuedIn.has(e.userId))
        this.addToQueue(e.userId, tournamentId, e.joinedAt);
    }
  }

  private async requeueIfFree(tournamentId: string, entries: QueueEntry[]) {
    const busy = await this.db
      .select({ userId: playerActiveMatch.userId })
      .from(playerActiveMatch)
      .where(
        inArray(
          playerActiveMatch.userId,
          entries.map((e) => e.userId),
        ),
      );
    const busyIds = new Set(busy.map((r) => r.userId));
    this.requeue(
      tournamentId,
      entries.filter((e) => !busyIds.has(e.userId)),
    );
  }

  private clearQueue(tournamentId: string) {
    for (const e of this.queues.get(tournamentId) ?? [])
      this.queuedIn.delete(e.userId);
    this.queues.delete(tournamentId);
  }
}

function httpErrorFor(d: Extract<QueueDecision, { ok: false }>) {
  const body = { code: d.code, message: d.message, details: d.details };
  if (d.status === 403) return new ForbiddenException(body);
  if (d.status === 404) return new NotFoundException(body);
  return new ConflictException(body);
}
