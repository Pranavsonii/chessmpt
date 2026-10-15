import type { MatchResult } from '../../db/schema';

/**
 * Tournament standings, computed from finished games (compute-on-read: the match
 * results are the single source of truth, so standings can never drift from them).
 *
 * Scoring uses integers only:
 * - points in HALF-points: win 2, draw 1, loss 0 (display ÷ 2 → 2½)
 * - Sonneborn-Berger in QUARTER-points: for each win add the opponent's
 *   half-points × 2, for each draw add them × 1 (display ÷ 4 → 3¼)
 * so every sum and every equality check in the tiebreaks is exact.
 *
 * Order: points → Sonneborn-Berger → wins → head-to-head (only when exactly two
 * players are still tied) → name. Name only makes the display order deterministic;
 * players still tied after head-to-head share a rank (competition ranking 1, 2, 2, 4).
 */

export interface StandingPlayer {
  id: string;
  name: string;
}

/** A completed game. Aborted games never count and are filtered out by the caller. */
export interface ScoredGame {
  whiteId: string;
  blackId: string;
  result: MatchResult;
}

export interface StandingRow {
  rank: number;
  userId: string;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  /** Points × 2 (a win is 2). */
  halfPoints: number;
  /** Sonneborn-Berger × 4. */
  sbQuarters: number;
}

/** Half-points the white and the black player get from one result. */
function halfPointsOf(result: MatchResult): { white: number; black: number } {
  if (result === '1-0') return { white: 2, black: 0 };
  if (result === '0-1') return { white: 0, black: 2 };
  return { white: 1, black: 1 };
}

export function computeStandings(
  players: StandingPlayer[],
  games: ScoredGame[],
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    players.map((p) => [
      p.id,
      {
        rank: 0,
        userId: p.id,
        name: p.name,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        halfPoints: 0,
        sbQuarters: 0,
      },
    ]),
  );
  // Only games between two known participants count.
  const counted = games.filter(
    (g) => rows.has(g.whiteId) && rows.has(g.blackId),
  );

  // Pass 1: points and W/D/L.
  for (const g of counted) {
    const hp = halfPointsOf(g.result);
    for (const [id, got] of [
      [g.whiteId, hp.white],
      [g.blackId, hp.black],
    ] as const) {
      const r = rows.get(id)!;
      r.played += 1;
      r.halfPoints += got;
      if (got === 2) r.wins += 1;
      else if (got === 1) r.draws += 1;
      else r.losses += 1;
    }
  }

  // Pass 2: Sonneborn-Berger needs every opponent's FINAL score, hence a second pass.
  for (const g of counted) {
    const hp = halfPointsOf(g.result);
    const white = rows.get(g.whiteId)!;
    const black = rows.get(g.blackId)!;
    // got 2 (win) → opponent × 2, got 1 (draw) → opponent × 1, got 0 → nothing
    white.sbQuarters += hp.white * black.halfPoints;
    black.sbQuarters += hp.black * white.halfPoints;
  }

  const sorted = [...rows.values()].sort(
    (a, b) => compareScores(a, b) || a.name.localeCompare(b.name),
  );
  return assignRanks(sorted, counted);
}

/** Negative when `a` ranks higher, 0 when tied on points, SB and wins. */
function compareScores(a: StandingRow, b: StandingRow): number {
  return (
    b.halfPoints - a.halfPoints ||
    b.sbQuarters - a.sbQuarters ||
    b.wins - a.wins
  );
}

/** Half-points `a` scored against `b` minus what `b` scored against `a`. */
function headToHead(a: string, b: string, games: ScoredGame[]): number {
  let diff = 0;
  for (const g of games) {
    const hp = halfPointsOf(g.result);
    if (g.whiteId === a && g.blackId === b) diff += hp.white - hp.black;
    else if (g.whiteId === b && g.blackId === a) diff += hp.black - hp.white;
  }
  return diff;
}

/**
 * Competition ranking over groups that are tied on points, SB and wins.
 * A group of exactly two is split by head-to-head when that is decisive.
 */
function assignRanks(
  sorted: StandingRow[],
  games: ScoredGame[],
): StandingRow[] {
  const out: StandingRow[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && compareScores(sorted[i], sorted[j]) === 0) j++;
    const group = sorted.slice(i, j);
    const rank = i + 1;

    if (group.length === 2) {
      const h2h = headToHead(group[0].userId, group[1].userId, games);
      if (h2h !== 0) {
        const [first, second] = h2h > 0 ? group : [group[1], group[0]];
        out.push({ ...first, rank }, { ...second, rank: rank + 1 });
        i = j;
        continue;
      }
    }
    for (const r of group) out.push({ ...r, rank });
    i = j;
  }
  return out;
}

/**
 * The tournament winner(s): everyone ranked 1st, provided at least one game was
 * played. More than one entry means co-winners.
 */
export function winnersOf(rows: StandingRow[]): StandingRow[] {
  if (!rows.some((r) => r.played > 0)) return [];
  return rows.filter((r) => r.rank === 1);
}
