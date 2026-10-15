import {
  assignColors,
  pairKey,
  pickPair,
  REMATCH_AFTER_MS,
  type QueueEntry,
} from './pairing';

const entry = (userId: string, joinedAt: number): QueueEntry => ({
  userId,
  joinedAt,
});
const ids = (pair: [QueueEntry, QueueEntry] | null) =>
  pair?.map((e) => e.userId) ?? null;
const NOW = 1_000_000;

describe('pairKey', () => {
  it('is order-independent', () => {
    expect(pairKey('a', 'b')).toBe(pairKey('b', 'a'));
  });
});

describe('pickPair', () => {
  it('returns null for an empty queue or a single player', () => {
    expect(pickPair([], new Set(), NOW)).toBeNull();
    expect(pickPair([entry('a', 1)], new Set(), NOW)).toBeNull();
  });

  it('pairs the two oldest waiters (FIFO)', () => {
    const q = [entry('c', 30), entry('a', 10), entry('b', 20)];
    expect(ids(pickPair(q, new Set(), NOW))).toEqual(['a', 'b']);
  });

  it('never pairs a player with themselves', () => {
    // A duplicate entry for the same user must not produce a self-pair.
    expect(pickPair([entry('a', 1), entry('a', 2)], new Set(), NOW)).toBeNull();
  });

  it('skips an opponent already played and takes the next fresh one', () => {
    const q = [entry('a', 10), entry('b', 20), entry('c', 30)];
    const played = new Set([pairKey('a', 'b')]);
    expect(ids(pickPair(q, played, NOW))).toEqual(['a', 'c']);
  });

  it("doesn't let a player with no fresh opponent block the others (head-of-line)", () => {
    // a has played b and c; b and c haven't played each other.
    const q = [
      entry('a', NOW - 1000),
      entry('b', NOW - 900),
      entry('c', NOW - 800),
    ];
    const played = new Set([pairKey('a', 'b'), pairKey('a', 'c')]);
    expect(ids(pickPair(q, played, NOW))).toEqual(['b', 'c']);
  });

  it('waits instead of forcing an immediate rematch', () => {
    const q = [entry('a', NOW - 1000), entry('b', NOW - 500)];
    expect(pickPair(q, new Set([pairKey('a', 'b')]), NOW)).toBeNull();
  });

  it('allows a rematch once the oldest player has waited long enough', () => {
    const q = [entry('a', NOW - REMATCH_AFTER_MS), entry('b', NOW - 500)];
    expect(ids(pickPair(q, new Set([pairKey('a', 'b')]), NOW))).toEqual([
      'a',
      'b',
    ]);
  });
});

describe('assignColors', () => {
  it('gives white to the player with fewer white games', () => {
    const counts = new Map([
      ['a', 2],
      ['b', 1],
    ]);
    expect(assignColors('a', 'b', counts)).toEqual({
      whiteId: 'b',
      blackId: 'a',
    });
    expect(assignColors('b', 'a', counts)).toEqual({
      whiteId: 'b',
      blackId: 'a',
    });
  });

  it('treats "never played" as zero white games', () => {
    expect(assignColors('a', 'b', new Map([['b', 1]]))).toEqual({
      whiteId: 'a',
      blackId: 'b',
    });
  });

  it('flips a coin on a tie', () => {
    expect(assignColors('a', 'b', new Map(), () => 0.1)).toEqual({
      whiteId: 'a',
      blackId: 'b',
    });
    expect(assignColors('a', 'b', new Map(), () => 0.9)).toEqual({
      whiteId: 'b',
      blackId: 'a',
    });
  });
});
