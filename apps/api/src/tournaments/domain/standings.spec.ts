import type { MatchResult } from '../../db/schema';
import {
  computeStandings,
  type StandingGame,
  type StandingPlayer,
  winnersOf,
} from './standings';

const P = (...names: string[]): StandingPlayer[] =>
  names.map((n) => ({ id: n.toLowerCase(), name: n }));
const G = (
  white: string,
  black: string,
  result: MatchResult,
): StandingGame => ({
  whiteId: white,
  blackId: black,
  result,
});
/** rank:name pairs, for compact assertions. */
const order = (rows: ReturnType<typeof computeStandings>) =>
  rows.map((r) => `${r.rank}:${r.name}`);

describe('computeStandings', () => {
  it('lists every participant, even with no games, all sharing rank 1', () => {
    const rows = computeStandings(P('Bea', 'Ann'), []);
    expect(order(rows)).toEqual(['1:Ann', '1:Bea']); // name only orders the display
    expect(rows[0]).toMatchObject({ played: 0, halfPoints: 0, sbQuarters: 0 });
    expect(winnersOf(rows)).toEqual([]); // no games, no winner
  });

  it('scores in half-points: win 2, draw 1, loss 0', () => {
    const rows = computeStandings(P('Ann', 'Bob', 'Cat'), [
      G('ann', 'bob', '1-0'),
      G('cat', 'ann', '1/2-1/2'),
      G('bob', 'cat', '0-1'),
    ]);
    const ann = rows.find((r) => r.userId === 'ann')!;
    expect(ann).toMatchObject({
      played: 2,
      wins: 1,
      draws: 1,
      losses: 0,
      halfPoints: 3,
    });
    expect(rows.find((r) => r.userId === 'bob')).toMatchObject({
      halfPoints: 0,
      losses: 2,
    });
  });

  it('breaks a points tie with Sonneborn-Berger (in quarter-points)', () => {
    // Ann and Bob both finish on 1 point. Ann beat Cat (who scored 1), Bob beat Dan (who scored 0).
    const rows = computeStandings(P('Ann', 'Bob', 'Cat', 'Dan'), [
      G('ann', 'cat', '1-0'),
      G('bob', 'dan', '1-0'),
      G('cat', 'dan', '1-0'),
      G('dan', 'ann', '1-0'),
      G('cat', 'bob', '1-0'),
    ]);
    const ann = rows.find((r) => r.userId === 'ann')!;
    const bob = rows.find((r) => r.userId === 'bob')!;
    expect(ann.halfPoints).toBe(bob.halfPoints);
    // Ann: beat Cat (Cat has 2 wins = 4 half-points) -> 4 × 2 = 8 quarters.
    expect(ann.sbQuarters).toBe(8);
    // Bob: beat Dan (1 win = 2 half-points) -> 2 × 2 = 4 quarters.
    expect(bob.sbQuarters).toBe(4);
    expect(ann.rank).toBeLessThan(bob.rank);
  });

  it('counts half the opponent score for a draw (a quarter-point result)', () => {
    // Cat ends on 2½ (5 half-points); drawing her is worth 1¼ = 5 quarters.
    const rows = computeStandings(P('Ann', 'Cat', 'Dan', 'Eve'), [
      G('ann', 'cat', '1/2-1/2'),
      G('cat', 'dan', '1-0'),
      G('cat', 'eve', '1-0'),
    ]);
    expect(rows.find((r) => r.userId === 'ann')!.sbQuarters).toBe(5);
  });

  it('then prefers more wins', () => {
    // Ann (1 win) and Bob (2 draws) both have 1 point and SB 1 (4 quarters).
    const rows = computeStandings(P('Ann', 'Bob', 'Xia', 'Yan', 'Quinn'), [
      G('ann', 'xia', '1-0'),
      G('xia', 'quinn', '1-0'),
      G('bob', 'yan', '1/2-1/2'),
      G('yan', 'bob', '1/2-1/2'),
    ]);
    const ann = rows.find((r) => r.userId === 'ann')!;
    const bob = rows.find((r) => r.userId === 'bob')!;
    expect([ann.halfPoints, ann.sbQuarters]).toEqual([
      bob.halfPoints,
      bob.sbQuarters,
    ]);
    expect(ann.wins).toBeGreaterThan(bob.wins);
    // Bob and Yan are tied on everything and drew each other: shared rank 2.
    expect(order(rows)).toEqual([
      '1:Ann',
      '2:Bob',
      '2:Yan',
      '4:Xia',
      '5:Quinn',
    ]);
  });

  it('then head-to-head, when exactly two are still tied', () => {
    // Ann and Bob: 2 points, SB 4 (16 quarters), 2 wins each. Ann beat Bob twice.
    const rows = computeStandings(P('Ann', 'Bob', 'Cat', 'Dan'), [
      G('ann', 'bob', '1-0'),
      G('bob', 'ann', '0-1'),
      G('bob', 'cat', '1-0'),
      G('cat', 'bob', '0-1'),
      G('cat', 'dan', '1-0'),
      G('dan', 'cat', '0-1'),
    ]);
    const ann = rows.find((r) => r.userId === 'ann')!;
    const bob = rows.find((r) => r.userId === 'bob')!;
    expect([ann.halfPoints, ann.sbQuarters, ann.wins]).toEqual([4, 16, 2]);
    expect([bob.halfPoints, bob.sbQuarters, bob.wins]).toEqual([4, 16, 2]);
    // Cat also has 2 points but SB 0, so she isn't part of the tie.
    expect(order(rows)).toEqual(['1:Ann', '2:Bob', '3:Cat', '4:Dan']);
  });

  it('gives a shared rank and skips the next one (1, 2, 2, 4)', () => {
    const rows = computeStandings(P('Ann', 'Bob', 'Cat', 'Dan'), [
      G('ann', 'dan', '1-0'),
      G('ann', 'bob', '1-0'),
      G('bob', 'cat', '1/2-1/2'),
    ]);
    expect(order(rows)).toEqual(['1:Ann', '2:Bob', '2:Cat', '4:Dan']);
  });

  it('a two-way tie with an even head-to-head stays shared', () => {
    const rows = computeStandings(P('Ann', 'Bob'), [
      G('ann', 'bob', '1/2-1/2'),
    ]);
    expect(order(rows)).toEqual(['1:Ann', '1:Bob']);
    expect(winnersOf(rows).map((r) => r.name)).toEqual(['Ann', 'Bob']); // co-winners
  });

  it('a three-way tie is not split by head-to-head', () => {
    // A cycle: Ann beats Bob, Bob beats Cat, Cat beats Ann.
    const rows = computeStandings(P('Ann', 'Bob', 'Cat'), [
      G('ann', 'bob', '1-0'),
      G('bob', 'cat', '1-0'),
      G('cat', 'ann', '1-0'),
    ]);
    expect(rows.every((r) => r.rank === 1)).toBe(true);
  });

  it('ignores games with non-participants', () => {
    const rows = computeStandings(P('Ann'), [G('ann', 'ghost', '1-0')]);
    expect(rows[0].played).toBe(0);
  });

  it('declares a single winner', () => {
    const rows = computeStandings(P('Ann', 'Bob'), [G('bob', 'ann', '0-1')]);
    expect(winnersOf(rows).map((r) => r.name)).toEqual(['Ann']);
  });
});
