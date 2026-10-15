import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleDestroy,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Chess, type Move } from 'chess.js';
import { eq } from 'drizzle-orm';
import type { AuthUser } from '../auth/auth.types';
import { DB, type Database } from '../db/client';
import {
  type MatchResult,
  type MatchTermination,
  matches,
  moves,
  playerActiveMatch,
} from '../db/schema';
import {
  type ClockView,
  clockView,
  FIRST_MOVE_GRACE_MS,
  otherSide,
  type Side,
  stopClock,
} from './domain/clock';
import {
  applyMove,
  deadline,
  expiry,
  type GameEnd,
  type LiveGame,
  type MoveInput,
  type MoveRejection,
  type PlayerRef,
  sideOfUser,
  toMove,
  winFor,
} from './domain/live-game';
import { setGameHeaders, setResultHeaders } from './domain/pgn';
import { GameBroadcaster } from './game.broadcaster';

// ---------------------------------------------------------------- payloads

export interface MoveView {
  ply: number;
  san: string;
  from: string;
  to: string;
}

/** Everything a client needs to draw the game from scratch (join and reconnect). */
export interface MatchSnapshot {
  matchId: string;
  tournament: { id: string; name: string };
  white: PlayerRef;
  black: PlayerRef;
  status: LiveGame['status'];
  result: MatchResult | null;
  termination: MatchTermination | null;
  fen: string;
  pgn: string;
  moves: MoveView[];
  turn: Side;
  ply: number;
  clock: ClockView;
  /** While nobody has moved: when the game aborts unless White moves. */
  firstMoveDeadline: number | null;
}

/** match:moved, broadcast to both players after every accepted move. */
export interface MovedEvent {
  matchId: string;
  move: MoveView;
  fen: string;
  pgn: string;
  turn: Side;
  ply: number;
  clock: ClockView;
}

/** match:ended */
export interface EndedEvent {
  matchId: string;
  tournamentId: string;
  status: 'completed' | 'aborted';
  result: MatchResult | null;
  termination: MatchTermination | null;
  winnerId: string | null;
  fen: string;
  pgn: string;
  clock: ClockView;
}

const REJECTIONS: Record<MoveRejection, () => HttpException> = {
  NOT_A_PLAYER: () =>
    new ForbiddenException({
      code: 'NOT_A_PLAYER',
      message: 'You are not playing in this match',
    }),
  NOT_YOUR_TURN: () =>
    new ConflictException({
      code: 'NOT_YOUR_TURN',
      message: "It is your opponent's turn",
    }),
  GAME_OVER: () =>
    new ConflictException({ code: 'GAME_OVER', message: 'This game is over' }),
  STALE_PLY: () =>
    new ConflictException({
      code: 'STALE_PLY',
      message: 'Your board is out of date, resyncing',
    }),
  ILLEGAL_MOVE: () =>
    new UnprocessableEntityException({
      code: 'ILLEGAL_MOVE',
      message: 'That move is not legal',
    }),
};

const notFound = () =>
  new NotFoundException({
    code: 'MATCH_NOT_FOUND',
    message: 'Match not found',
  });

/**
 * The server-authoritative game engine.
 *
 * Active games live in memory (fast path, one Chess instance each) and every change
 * is written through to Postgres, so a restart can rebuild them from matches + moves.
 * Clients only ever send intent (from/to); legality, turn order and the clock are
 * decided here.
 *
 * Concurrency: Node runs one callback at a time, so the in-memory checks and the
 * mutation in applyMove can't interleave. DB writes are async, so each game has a
 * write queue that keeps them in the order the moves happened.
 */
@Injectable()
export class MatchEngine implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MatchEngine.name);
  private readonly games = new Map<string, LiveGame>();
  private readonly loading = new Map<string, Promise<LiveGame | null>>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly writes = new Map<string, Promise<void>>();

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly broadcast: GameBroadcaster,
  ) {}

  /** After a restart, pick every active game back up so its clock keeps running. */
  async onApplicationBootstrap(): Promise<void> {
    const active = await this.db
      .select({ id: matches.id })
      .from(matches)
      .where(eq(matches.status, 'active'));
    await Promise.all(active.map((m) => this.load(m.id)));
    if (active.length > 0) {
      this.logger.log(`Resumed ${active.length} active game(s)`);
    }
  }

  onModuleDestroy(): void {
    this.timers.forEach((t) => clearTimeout(t));
  }

  /** Starts tracking a newly created match (arms its first-move abort timer). */
  async track(matchId: string): Promise<void> {
    await this.load(matchId);
  }

  // ---------------------------------------------------------------- commands

  async snapshotFor(matchId: string, user: AuthUser): Promise<MatchSnapshot> {
    const game = await this.load(matchId);
    if (!game) throw notFound();
    if (!sideOfUser(game, user.id)) throw REJECTIONS.NOT_A_PLAYER();
    return this.snapshot(game, Date.now());
  }

  async move(
    matchId: string,
    user: AuthUser,
    input: MoveInput,
  ): Promise<{ ply: number }> {
    const game = await this.load(matchId);
    if (!game) throw notFound();

    const now = Date.now();
    const r = applyMove(game, user.id, input, now);
    if (!r.ok) {
      if (r.end) await this.finish(game, r.end, now);
      throw REJECTIONS[r.code]();
    }

    // Capture everything now: the game object keeps changing after we await.
    const event = this.movedEvent(game, r.move, now);
    const moveRow = {
      matchId,
      ply: game.ply,
      san: r.move.san,
      from: r.move.from,
      to: r.move.to,
      promotion: r.move.promotion ?? null,
      fenAfter: event.fen,
      whiteMs: game.clock.whiteMs,
      blackMs: game.clock.blackMs,
    };
    const matchUpdate = {
      fen: event.fen,
      pgn: event.pgn,
      whiteMs: game.clock.whiteMs,
      blackMs: game.clock.blackMs,
      turnStartedAt: new Date(now),
    };

    await this.enqueue(matchId, () =>
      this.db.transaction(async (tx) => {
        await tx.insert(moves).values(moveRow);
        await tx
          .update(matches)
          .set(matchUpdate)
          .where(eq(matches.id, matchId));
      }),
    );
    this.broadcast.toMatch(matchId, 'match:moved', event);

    if (r.end) await this.finish(game, r.end, now);
    else this.armTimer(game);
    return { ply: event.ply };
  }

  async resign(matchId: string, user: AuthUser): Promise<void> {
    const game = await this.load(matchId);
    if (!game) throw notFound();
    const side = sideOfUser(game, user.id);
    if (!side) throw REJECTIONS.NOT_A_PLAYER();
    if (game.status !== 'active') throw REJECTIONS.GAME_OVER();

    const now = Date.now();
    // If the flag already fell, that result stands, not the resignation.
    const end: GameEnd = expiry(game, now) ?? {
      kind: 'result',
      result: winFor(otherSide(side)),
      termination: 'resignation',
    };
    await this.finish(game, end, now);
  }

  // ---------------------------------------------------------------- lifecycle

  /**
   * Ends the game exactly once: freeze clocks, write the result and release both
   * players (deleting their player_active_match rows) in one transaction, then
   * tell the room and the tournament.
   */
  private async finish(game: LiveGame, end: GameEnd, now: number) {
    if (game.status !== 'active') return; // a move and the flag timer raced: first one wins
    const side = toMove(game);
    game.clock = stopClock(game.clock, side, now);
    game.status = end.kind === 'aborted' ? 'aborted' : 'completed';
    if (end.kind === 'result') {
      game.result = end.result;
      game.termination = end.termination;
    }
    setResultHeaders(game.chess, end);
    this.clearTimer(game.matchId);

    const ended: EndedEvent = {
      matchId: game.matchId,
      tournamentId: game.tournamentId,
      status: game.status,
      result: game.result,
      termination: game.termination,
      winnerId: winnerId(game),
      fen: game.chess.fen(),
      pgn: game.chess.pgn(),
      clock: clockView(game.clock, side, false, now),
    };

    await this.enqueue(game.matchId, () =>
      this.db.transaction(async (tx) => {
        await tx
          .update(matches)
          .set({
            status: ended.status,
            result: ended.result,
            termination: ended.termination,
            fen: ended.fen,
            pgn: ended.pgn,
            whiteMs: game.clock.whiteMs,
            blackMs: game.clock.blackMs,
            turnStartedAt: null,
            endedAt: new Date(now),
          })
          .where(eq(matches.id, game.matchId));
        await tx
          .delete(playerActiveMatch)
          .where(eq(playerActiveMatch.matchId, game.matchId));
      }),
    );

    this.games.delete(game.matchId);
    this.writes.delete(game.matchId);
    this.broadcast.toMatch(game.matchId, 'match:ended', ended);
    this.broadcast.toTournament(game.tournamentId, 'tournament:updated', {
      tournamentId: game.tournamentId,
    });
    this.logger.log(
      `match ${game.matchId} ${ended.status}: ${ended.result ?? '-'} (${ended.termination ?? 'aborted'})`,
    );
  }

  /**
   * One timer per game, for the moment it ends by itself (side to move flags, or
   * White never moves). The clock runs on the server even if both tabs are closed.
   */
  private armTimer(game: LiveGame): void {
    this.clearTimer(game.matchId);
    const at = deadline(game);
    if (at === null) return;
    const timer = setTimeout(
      () => void this.onDeadline(game.matchId),
      Math.max(0, at - Date.now()),
    );
    this.timers.set(game.matchId, timer);
  }

  private async onDeadline(matchId: string): Promise<void> {
    const game = this.games.get(matchId);
    if (!game) return;
    const now = Date.now();
    const end = expiry(game, now); // re-check: never trust that the timer is exact
    try {
      if (end) await this.finish(game, end, now);
      else this.armTimer(game);
    } catch (err) {
      this.logger.error(`Failed to end match ${matchId}`, err);
    }
  }

  private clearTimer(matchId: string): void {
    clearTimeout(this.timers.get(matchId));
    this.timers.delete(matchId);
  }

  /** Runs DB writes for one game strictly one after another. Never rejects. */
  private enqueue(matchId: string, write: () => Promise<unknown>) {
    const next = (this.writes.get(matchId) ?? Promise.resolve())
      .then(write)
      .then(
        () => undefined,
        (err: unknown) => {
          // Memory stays authoritative while the process lives, and the next
          // write carries the full fen/pgn/clocks again, so the match row heals.
          this.logger.error(`DB write failed for match ${matchId}`, err);
        },
      );
    this.writes.set(matchId, next);
    return next;
  }

  // ---------------------------------------------------------------- loading

  /** The live game, loading it from the DB if needed. Finished games are returned but not cached. */
  private load(matchId: string): Promise<LiveGame | null> {
    const live = this.games.get(matchId);
    if (live) return Promise.resolve(live);
    // Two sockets joining at once must not build two copies of the same game.
    let pending = this.loading.get(matchId);
    if (!pending) {
      pending = this.fetch(matchId).finally(() => this.loading.delete(matchId));
      this.loading.set(matchId, pending);
    }
    return pending;
  }

  private async fetch(matchId: string): Promise<LiveGame | null> {
    const row = await this.db.query.matches.findFirst({
      where: eq(matches.id, matchId),
      with: {
        tournament: true,
        white: { columns: { id: true, name: true } },
        black: { columns: { id: true, name: true } },
        moves: { orderBy: (m, { asc }) => [asc(m.ply)] },
      },
    });
    if (!row) return null;

    // Replaying the move log (rather than loading the FEN) restores the
    // repetition history that threefold detection needs.
    const chess = new Chess();
    setGameHeaders(chess, {
      event: row.tournament.name,
      date: row.startedAt,
      white: row.white.name,
      black: row.black.name,
      initialSeconds: row.tournament.initialSeconds,
      incrementSeconds: row.tournament.incrementSeconds,
    });
    for (const m of row.moves) {
      chess.move({
        from: m.from,
        to: m.to,
        promotion: m.promotion ?? undefined,
      });
    }

    const game: LiveGame = {
      matchId: row.id,
      tournamentId: row.tournamentId,
      tournamentName: row.tournament.name,
      white: row.white,
      black: row.black,
      chess,
      clock: {
        whiteMs: row.whiteMs,
        blackMs: row.blackMs,
        incrementMs: row.incrementMs,
        turnStartedAt: row.turnStartedAt?.getTime() ?? null,
      },
      startedAt: row.startedAt.getTime(),
      ply: row.moves.length,
      status: row.status,
      result: row.result,
      termination: row.termination,
    };

    if (game.status !== 'active') {
      if (game.result && game.termination) {
        setResultHeaders(chess, {
          kind: 'result',
          result: game.result,
          termination: game.termination,
        });
      }
      return game;
    }
    this.games.set(matchId, game);
    this.armTimer(game); // a deadline that passed while we were down fires immediately
    return game;
  }

  // ---------------------------------------------------------------- views

  private snapshot(game: LiveGame, now: number): MatchSnapshot {
    const active = game.status === 'active';
    return {
      matchId: game.matchId,
      tournament: { id: game.tournamentId, name: game.tournamentName },
      white: game.white,
      black: game.black,
      status: game.status,
      result: game.result,
      termination: game.termination,
      fen: game.chess.fen(),
      pgn: game.chess.pgn(),
      moves: game.chess
        .history({ verbose: true })
        .map((m, i) => ({ ply: i + 1, san: m.san, from: m.from, to: m.to })),
      turn: toMove(game),
      ply: game.ply,
      clock: clockView(game.clock, toMove(game), active, now),
      firstMoveDeadline:
        active && game.ply === 0 && game.clock.turnStartedAt === null
          ? game.startedAt + FIRST_MOVE_GRACE_MS
          : null,
    };
  }

  private movedEvent(game: LiveGame, move: Move, now: number): MovedEvent {
    return {
      matchId: game.matchId,
      move: { ply: game.ply, san: move.san, from: move.from, to: move.to },
      fen: game.chess.fen(),
      pgn: game.chess.pgn(),
      turn: toMove(game),
      ply: game.ply,
      clock: clockView(game.clock, toMove(game), true, now),
    };
  }
}

function winnerId(game: LiveGame): string | null {
  if (game.result === '1-0') return game.white.id;
  if (game.result === '0-1') return game.black.id;
  return null;
}
