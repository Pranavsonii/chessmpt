import { Chess, type Move } from 'chess.js';
import type { MatchResult, MatchTermination } from '../../db/schema';
import {
  type ClockState,
  clockAfterMove,
  FIRST_MOVE_GRACE_MS,
  otherSide,
  type Side,
  timeLeft,
} from './clock';

export interface PlayerRef {
  id: string;
  name: string;
}

/** One game being played right now. Lives in memory; every change is written through to Postgres. */
export interface LiveGame {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  white: PlayerRef;
  black: PlayerRef;
  /** Source of truth for the position, legality and repetition history. */
  chess: Chess;
  clock: ClockState;
  startedAt: number;
  /** Half-moves played so far. The next move must arrive with ply = this + 1. */
  ply: number;
  status: 'active' | 'completed' | 'aborted';
  result: MatchResult | null;
  termination: MatchTermination | null;
}

export type GameEnd =
  | { kind: 'result'; result: MatchResult; termination: MatchTermination }
  | { kind: 'aborted' };

export type MoveRejection =
  'NOT_A_PLAYER' | 'NOT_YOUR_TURN' | 'GAME_OVER' | 'STALE_PLY' | 'ILLEGAL_MOVE';

export interface MoveInput {
  from: string;
  to: string;
  promotion?: string;
  /** The ply this move would be (1 = White's first). Rejects duplicates and out-of-order sends. */
  ply: number;
}

export type MoveResult =
  | { ok: true; move: Move; end: GameEnd | null }
  /** `end` is set when the attempt revealed the game was already over (flag fell, abort window passed). */
  | { ok: false; code: MoveRejection; end?: GameEnd };

const sideOf = (c: 'w' | 'b'): Side => (c === 'w' ? 'white' : 'black');

export const toMove = (game: LiveGame): Side => sideOf(game.chess.turn());

export const winFor = (side: Side): MatchResult =>
  side === 'white' ? '1-0' : '0-1';

export function sideOfUser(game: LiveGame, userId: string): Side | null {
  if (userId === game.white.id) return 'white';
  if (userId === game.black.id) return 'black';
  return null;
}

/** Epoch ms at which the game ends by itself if nobody moves (flag fall or abort), or null. */
export function deadline(game: LiveGame): number | null {
  if (game.status !== 'active') return null;
  const { clock } = game;
  if (clock.turnStartedAt === null) {
    return game.ply === 0 ? game.startedAt + FIRST_MOVE_GRACE_MS : null;
  }
  const stored = toMove(game) === 'white' ? clock.whiteMs : clock.blackMs;
  return clock.turnStartedAt + stored;
}

/** Has the game ended through the passage of time alone? Used by moves and by the flag timer. */
export function expiry(game: LiveGame, now: number): GameEnd | null {
  if (game.status !== 'active') return null;
  if (game.clock.turnStartedAt === null) {
    const d = deadline(game);
    return d !== null && now >= d ? { kind: 'aborted' } : null;
  }
  const side = toMove(game);
  if (timeLeft(game.clock, side, side, now) > 0) return null;
  // Simplification: FIDE scores a flag as a draw when the opponent couldn't
  // possibly mate; we always award the win.
  return {
    kind: 'result',
    result: winFor(otherSide(side)),
    termination: 'timeout',
  };
}

/** Checks the position after a move for every rule-based ending. */
export function detectEnd(chess: Chess): GameEnd | null {
  if (chess.isCheckmate()) {
    // The side to move is mated, so the side that just moved wins.
    const winner = otherSide(sideOf(chess.turn()));
    return { kind: 'result', result: winFor(winner), termination: 'checkmate' };
  }
  const draw = (termination: MatchTermination): GameEnd => ({
    kind: 'result',
    result: '1/2-1/2',
    termination,
  });
  if (chess.isStalemate()) return draw('stalemate');
  if (chess.isInsufficientMaterial()) return draw('insufficient_material');
  if (chess.isThreefoldRepetition()) return draw('threefold_repetition');
  if (chess.isDrawByFiftyMoves()) return draw('fifty_move_rule');
  return null;
}

/**
 * Validates and applies one move. Mutates `game` only if the move is accepted.
 * The checks run in a fixed order, and the first failure wins.
 */
export function applyMove(
  game: LiveGame,
  userId: string,
  input: MoveInput,
  now: number,
): MoveResult {
  if (game.status !== 'active') return { ok: false, code: 'GAME_OVER' };

  const mover = sideOfUser(game, userId);
  if (!mover) return { ok: false, code: 'NOT_A_PLAYER' };
  if (mover !== toMove(game)) return { ok: false, code: 'NOT_YOUR_TURN' };
  if (input.ply !== game.ply + 1) return { ok: false, code: 'STALE_PLY' };

  // Out of time before the move arrived: the move doesn't count, the game is over.
  const timeUp = expiry(game, now);
  if (timeUp) return { ok: false, code: 'GAME_OVER', end: timeUp };

  let move: Move;
  try {
    move = game.chess.move({
      from: input.from,
      to: input.to,
      promotion: input.promotion,
    });
  } catch {
    return { ok: false, code: 'ILLEGAL_MOVE' };
  }

  game.clock = clockAfterMove(game.clock, mover, now);
  game.ply += 1;
  return { ok: true, move, end: detectEnd(game.chess) };
}
