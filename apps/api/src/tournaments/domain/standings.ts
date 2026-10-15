import type { MatchResult } from '../../db/schema';
import {
  type Color,
  outcomeFor,
  type Outcome,
} from '../../matches/domain/outcome';

/**
 * Tournament standings. Pure: no DB, recomputed from match results on every read,
 * so the table can never drift from the games.
 *
 * Everything is an integer, so sums and tie comparisons are exact:
 * - points in HALF-points: win 2, draw 1, loss 0 (2½ points is stored as 5)
 * - Sonneborn-Berger in QUARTER-points: a draw against someone on 2½ adds 1¼
 * Only the UI divides (by 2 and by 4) for display.
 *
 * Order:
 *   1. points (desc)
 *   2. Sonneborn-Berger (desc): opponent's points for each win + half of them for each draw
 *   3. wins (desc)
 *   4. head-to-head, only when exactly two players are still tied
 *   5. still tied: same rank ("1, 2, 2, 4"); listed by name for a stable display
 */

export interface StandingPlayer {
  id: string;
  name: string;
}

export interface StandingGame {
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
  halfPoints: number;
  sbQuarters: number;
}

const HALF_POINTS: Record<Outcome, number> = { win: 2, draw: 1, loss: 0 };

type Tally = Omit<StandingRow, 'rank'>;

/** Ordered by criteria 1–3 only (negative = a ranks above b). */
const byScore = (a: Tally, b: Tally) =>
  b.halfPoints - a.halfPoints || b.sbQuarters - a.sbQuarters || b.wins - a.wins;

/** a's half-points minus b's, over the games they played against each other. */
function headToHead(a: string, b: string, games: StandingGame[]): number {
  let diff = 0;
  for (const g of games) {
    const color: Color | null =
      g.whiteId === a && g.blackId === b
        ? 'white'
        : g.blackId === a && g.whiteId === b
          ? 'black'
          : null;
    if (!color) continue;
    const forA = HALF_POINTS[outcomeFor(g.result, color)];
    diff += forA - (2 - forA); // each game hands out 2 half-points in total
  }
  return diff;
}

export function computeStandings(
  players: StandingPlayer[],
  games: StandingGame[],
): StandingRow[] {
  const tally = new Map<string, Tally>(
    players.map((p) => [
      p.id,
      {
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
  // Ignore games involving someone who isn't a participant (shouldn't happen).
  const counted = games.filter(
    (g) => tally.has(g.whiteId) && tally.has(g.blackId),
  );

  // Pass 1: results and points.
  for (const g of counted) {
    for (const color of ['white', 'black'] as const) {
      const row = tally.get(color === 'white' ? g.whiteId : g.blackId)!;
      const outcome = outcomeFor(g.result, color);
      row.played += 1;
      row.halfPoints += HALF_POINTS[outcome];
      if (outcome === 'win') row.wins += 1;
      else if (outcome === 'draw') row.draws += 1;
      else row.losses += 1;
    }
  }

  // Pass 2: Sonneborn-Berger needs every opponent's FINAL points, so it comes after.
  // Win: + opponent's half-points × 2 (in quarters). Draw: + opponent's half-points × 1.
  for (const g of counted) {
    const white = tally.get(g.whiteId)!;
    const black = tally.get(g.blackId)!;
    if (g.result === '1/2-1/2') {
      white.sbQuarters += black.halfPoints;
      black.sbQuarters += white.halfPoints;
    } else if (g.result === '1-0') {
      white.sbQuarters += black.halfPoints * 2;
    } else {
      black.sbQuarters += white.halfPoints * 2;
    }
  }

  const sorted = [...tally.values()].sort(
    (a, b) => byScore(a, b) || a.name.localeCompare(b.name),
  );

  // Walk groups tied on criteria 1–3 and assign competition ranks.
  const rows: StandingRow[] = [];
  for (let i = 0; i < sorted.length;) {
    let j = i + 1;
    while (j < sorted.length && byScore(sorted[i], sorted[j]) === 0) j++;
    const group = sorted.slice(i, j);

    const h2h =
      group.length === 2
        ? headToHead(group[0].userId, group[1].userId, counted)
        : 0;
    if (h2h !== 0) {
      const [first, second] = h2h > 0 ? group : [group[1], group[0]];
      rows.push({ ...first, rank: i + 1 }, { ...second, rank: i + 2 });
    } else {
      for (const r of group) rows.push({ ...r, rank: i + 1 });
    }
    i = j;
  }
  return rows;
}

/**
 * Everyone on rank 1: one winner, or co-winners when still tied after every
 * tiebreak. Nobody wins a tournament in which no game was played.
 */
export function winnersOf(rows: StandingRow[]): StandingRow[] {
  if (!rows.some((r) => r.played > 0)) return [];
  return rows.filter((r) => r.rank === 1);
}
