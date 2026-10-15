import type { MatchResult } from '../../db/schema';
import {
  computeStandings,
  winnersOf,
  type ScoredGame,
  type StandingRow,
} from './standings';

const players = (...names: string[]) => names.map((n) => ({ id: n, name: n }));
const game = (
  whiteId: string,
  blackId: string,
  result: MatchResult,
): ScoredGame => ({
  whiteId,
  blackId,
  result,
});
/** name → rank, in table order */
const ranks = (rows: StandingRow[]) => rows.map((r) => [r.name, r.rank]);
const row = (rows: StandingRow[], name: string) =>
  rows.find((r) => r.name === name)!;

describe('computeStandings', () => {
  it('scores a win as 2 half-points, a draw as 1 and a loss as 0', () => {
    const rows = computeStandings(players('A', 'B', 'C'), [
      game('A', 'B', '1-0'),
      game('C', 'A', '1/2-1/2'),
    ]);
    expect(row(rows, 'A')).toMatchObject({
      played: 2,
      wins: 1,
      draws: 1,
      losses: 0,
      halfPoints: 3,
    });
    expect(row(rows, 'B')).toMatchObject({
      played: 1,
      wins: 0,
      draws: 0,
      losses: 1,
      halfPoints: 0,
    });
    expect(row(rows, 'C')).toMatchObject({
      played: 1,
      wins: 0,
      draws: 1,
      losses: 0,
      halfPoints: 1,
    });
  });

  it('lists a participant with no games, with zero points', () => {
    const rows = computeStandings(players('A', 'B', 'Idle'), [
      game('A', 'B', '0-1'),
    ]);
    expect(row(rows, 'Idle')).toMatchObject({
      played: 0,
      halfPoints: 0,
      sbQuarters: 0,
    });
    expect(rows).toHaveLength(3);
  });

  it('with no games at all, everyone shares rank 1 in name order', () => {
    expect(ranks(computeStandings(players('Cara', 'Abe', 'Ben'), []))).toEqual([
      ['Abe', 1],
      ['Ben', 1],
      ['Cara', 1],
    ]);
  });

  it('breaks a points tie with Sonneborn-Berger, and shares a rank when still tied', () => {
    // A, B and C all have one win. A beat C (1 point) → SB 1; B and C beat D (0 points) → SB 0.
    const rows = computeStandings(players('A', 'B', 'C', 'D'), [
      game('A', 'C', '1-0'),
      game('B', 'D', '1-0'),
      game('C', 'D', '1-0'),
    ]);
    expect(row(rows, 'A').sbQuarters).toBe(4); // beat C, who has 1 point → SB 1 = 4 quarters
    expect(ranks(rows)).toEqual([
      ['A', 1],
      ['B', 2], // B and C: same points, SB and wins, never played → shared rank
      ['C', 2],
      ['D', 4], // competition ranking skips 3
    ]);
  });

  it('computes Sonneborn-Berger in quarter-points: a draw adds the opponent’s points × ½', () => {
    // A drew with B; B also beat C → B has 1½ points, so A's SB is ¾ = 3 quarters.
    const rows = computeStandings(players('A', 'B', 'C'), [
      game('A', 'B', '1/2-1/2'),
      game('B', 'C', '1-0'),
    ]);
    expect(row(rows, 'A').sbQuarters).toBe(3);
    expect(row(rows, 'B').sbQuarters).toBe(1); // drew A (½ point → ¼), beat C (0)
  });

  it('breaks a points + SB tie by number of wins', () => {
    // X: two draws (1 point, SB = ½ × ½ + ½ × ½ = ½). Y: a win and a loss (1 point, SB = R's ½).
    const rows = computeStandings(players('X', 'Y', 'P', 'Q', 'R', 'S', 'T'), [
      game('X', 'P', '1/2-1/2'),
      game('X', 'Q', '1/2-1/2'),
      game('Y', 'R', '1-0'),
      game('S', 'Y', '1-0'),
      game('R', 'T', '1/2-1/2'),
    ]);
    expect(row(rows, 'X')).toMatchObject({
      halfPoints: 2,
      sbQuarters: 2,
      wins: 0,
    });
    expect(row(rows, 'Y')).toMatchObject({
      halfPoints: 2,
      sbQuarters: 2,
      wins: 1,
    });
    expect(ranks(rows)).toEqual([
      ['S', 1], // 1 point, SB = Y's 1 point = 4 quarters
      ['Y', 2],
      ['X', 3],
      ['P', 4],
      ['Q', 4],
      ['R', 6],
      ['T', 6], // drew each other: head-to-head is level → shared
    ]);
  });

  it('breaks an exact two-way tie by head-to-head', () => {
    // A and B: 1 win, 1 loss, SB 1 (4 quarters) each. A beat B.
    const rows = computeStandings(players('B', 'A', 'X', 'Y', 'Z'), [
      game('B', 'A', '0-1'),
      game('X', 'A', '1-0'),
      game('B', 'Y', '1-0'),
      game('Y', 'Z', '1-0'),
      game('X', 'Z', '1/2-1/2'),
    ]);
    expect(row(rows, 'A')).toMatchObject({
      halfPoints: 2,
      sbQuarters: 4,
      wins: 1,
    });
    expect(row(rows, 'B')).toMatchObject({
      halfPoints: 2,
      sbQuarters: 4,
      wins: 1,
    });
    expect(ranks(rows)).toEqual([
      ['X', 1],
      ['A', 2],
      ['B', 3],
      ['Y', 4],
      ['Z', 5],
    ]);
  });

  it('does not use head-to-head for a three-way tie: a cycle shares the rank', () => {
    const rows = computeStandings(players('A', 'B', 'C'), [
      game('A', 'B', '1-0'),
      game('B', 'C', '1-0'),
      game('C', 'A', '1-0'),
    ]);
    expect(ranks(rows)).toEqual([
      ['A', 1],
      ['B', 1],
      ['C', 1],
    ]);
  });

  it('ignores games involving someone who is not a participant', () => {
    const rows = computeStandings(players('A', 'B'), [
      game('A', 'ghost', '1-0'),
    ]);
    expect(row(rows, 'A')).toMatchObject({ played: 0, halfPoints: 0 });
  });
});

describe('winnersOf', () => {
  it('returns the single player ranked first', () => {
    const rows = computeStandings(players('A', 'B'), [game('A', 'B', '1-0')]);
    expect(winnersOf(rows).map((r) => r.name)).toEqual(['A']);
  });

  it('returns every co-winner when first place is shared', () => {
    const rows = computeStandings(players('A', 'B', 'C'), [
      game('A', 'B', '1-0'),
      game('B', 'C', '1-0'),
      game('C', 'A', '1-0'),
    ]);
    expect(winnersOf(rows).map((r) => r.name)).toEqual(['A', 'B', 'C']);
  });

  it('declares no winner when no game was played', () => {
    expect(winnersOf(computeStandings(players('A', 'B'), []))).toEqual([]);
  });
});
