import type { Chess } from 'chess.js';
import type { MatchTermination } from '../../db/schema';
import type { GameEnd } from './live-game';

/** 2026-10-15T... -> "2026.10.15", the PGN date format. */
export const pgnDate = (d: Date) =>
  d.toISOString().slice(0, 10).replace(/-/g, '.');

/**
 * The PGN standard's Termination tag only has a few values ("normal", "time forfeit",
 * "abandoned", ...). The precise reason (stalemate, threefold...) is in our
 * `termination` column; the tag says whether the game ended over the board.
 */
const PGN_TERMINATION: Record<MatchTermination, string> = {
  checkmate: 'normal',
  resignation: 'normal',
  stalemate: 'normal',
  insufficient_material: 'normal',
  threefold_repetition: 'normal',
  fifty_move_rule: 'normal',
  draw_agreement: 'normal',
  timeout: 'time forfeit',
};

export function setGameHeaders(
  chess: Chess,
  h: {
    event: string;
    date: Date;
    white: string;
    black: string;
    initialSeconds: number;
    incrementSeconds: number;
  },
): void {
  chess.setHeader('Event', h.event);
  chess.setHeader('Site', 'Kingdom of Chess');
  chess.setHeader('Date', pgnDate(h.date));
  chess.setHeader('White', h.white);
  chess.setHeader('Black', h.black);
  chess.setHeader('TimeControl', `${h.initialSeconds}+${h.incrementSeconds}`);
  chess.setHeader('Result', '*'); // "game in progress"
}

export function setResultHeaders(chess: Chess, end: GameEnd): void {
  if (end.kind === 'aborted') {
    chess.setHeader('Termination', 'abandoned');
    return;
  }
  chess.setHeader('Result', end.result);
  chess.setHeader('Termination', PGN_TERMINATION[end.termination]);
}
