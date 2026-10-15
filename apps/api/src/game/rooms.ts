/**
 * Room names in one place. Rooms are server-side groups: clients can never join
 * one themselves, the gateway decides who goes where.
 */
export const rooms = {
  /** Every socket of one user (all tabs, reconnects), for targeted pushes. */
  user: (userId: string) => `user:${userId}`,
  /** The two players of a match. */
  match: (matchId: string) => `match:${matchId}`,
};
