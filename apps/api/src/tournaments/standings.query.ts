import { and, asc, eq, isNotNull } from 'drizzle-orm';
import type { Database } from '../db/client';
import { matches, tournamentParticipants, users } from '../db/schema';
import { computeStandings, type StandingRow } from './domain/standings';

/** The db itself or an open transaction: both expose the same query API. */
type Executor = Pick<Database, 'select'>;

/**
 * Loads participants + completed games and computes the standings.
 * Takes an executor so changeStatus can run it inside its transaction and see
 * exactly the rows it has locked.
 */
export async function loadStandings(
  db: Executor,
  tournamentId: string,
): Promise<StandingRow[]> {
  // Sequential on purpose: inside a transaction both run on the same connection anyway.
  const players = await db
    .select({ id: users.id, name: users.name })
    .from(tournamentParticipants)
    .innerJoin(users, eq(users.id, tournamentParticipants.userId))
    .where(eq(tournamentParticipants.tournamentId, tournamentId))
    .orderBy(asc(tournamentParticipants.joinedAt));
  const games = await db
    .select({
      whiteId: matches.whiteId,
      blackId: matches.blackId,
      result: matches.result,
    })
    .from(matches)
    .where(
      and(
        eq(matches.tournamentId, tournamentId),
        eq(matches.status, 'completed'),
        isNotNull(matches.result),
      ),
    );

  return computeStandings(
    players,
    games.map((g) => ({ ...g, result: g.result! })),
  );
}
