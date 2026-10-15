import type { MatchResult } from '../../db/schema';

export type Color = 'white' | 'black';
export type Outcome = 'win' | 'loss' | 'draw';

/**
 * A result in PGN notation ("1-0", "0-1", "1/2-1/2") seen from one player's side.
 * Reused later by the leaderboard (Phase 10).
 */
export function outcomeFor(result: MatchResult, color: Color): Outcome {
  if (result === '1/2-1/2') return 'draw';
  const whiteWon = result === '1-0';
  return whiteWon === (color === 'white') ? 'win' : 'loss';
}
