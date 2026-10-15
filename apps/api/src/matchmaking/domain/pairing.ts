/**
 * Matchmaking rules, as pure functions: no DB, no timers, no sockets.
 * The service feeds them the current queue + history and acts on the answer.
 */

export interface QueueEntry {
  userId: string;
  joinedAt: number; // epoch ms
}

/**
 * How long a player waits for a NEW opponent before a rematch is allowed.
 * Avoids two players who already met being re-paired instantly, but also avoids
 * someone waiting forever near the end of a tournament when only rematches remain.
 */
export const REMATCH_AFTER_MS = 15_000;

/** Order-independent key for "these two already played": pairKey(a,b) === pairKey(b,a). */
export const pairKey = (a: string, b: string) =>
  a < b ? `${a}|${b}` : `${b}|${a}`;

/**
 * FIFO with rematch avoidance.
 *
 * Walk the queue oldest-first. For each waiting player, pair them with the oldest
 * OTHER waiter they haven't played yet. If they've played everyone currently
 * waiting, skip them for now (so they don't block others behind them, a.k.a.
 * head-of-line blocking), unless they've waited long enough to accept a rematch.
 *
 * Returns the pair [first, second] in queue order, or null if nobody can be paired.
 */
export function pickPair(
  queue: readonly QueueEntry[],
  played: ReadonlySet<string>,
  now: number,
  rematchAfterMs = REMATCH_AFTER_MS,
): [QueueEntry, QueueEntry] | null {
  const ordered = [...queue].sort((x, y) => x.joinedAt - y.joinedAt);

  for (const a of ordered) {
    const others = ordered.filter((b) => b.userId !== a.userId);
    if (others.length === 0) continue;

    const fresh = others.find((b) => !played.has(pairKey(a.userId, b.userId)));
    if (fresh) return inQueueOrder(a, fresh);

    if (now - a.joinedAt >= rematchAfterMs) return inQueueOrder(a, others[0]);
  }
  return null;
}

const inQueueOrder = (
  a: QueueEntry,
  b: QueueEntry,
): [QueueEntry, QueueEntry] => (a.joinedAt <= b.joinedAt ? [a, b] : [b, a]);

/**
 * Colour balancing: whoever has played white fewer times in this tournament gets white.
 * On a tie, flip a coin (`random` is injectable so tests are deterministic).
 */
export function assignColors(
  a: string,
  b: string,
  whiteCounts: ReadonlyMap<string, number>,
  random: () => number = Math.random,
): { whiteId: string; blackId: string } {
  const wa = whiteCounts.get(a) ?? 0;
  const wb = whiteCounts.get(b) ?? 0;
  const aIsWhite = wa === wb ? random() < 0.5 : wa < wb;
  return aIsWhite ? { whiteId: a, blackId: b } : { whiteId: b, blackId: a };
}
