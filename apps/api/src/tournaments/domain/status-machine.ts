import type { TournamentStatus } from '../../db/schema';

/**
 * Tournament lifecycle. Forward-only:
 *
 *   draft ──► open ──► ongoing ──► completed
 *   (coach    (students  (matchmaking  (no new games,
 *    only)     join)      runs)         winner declared)
 *
 * Going back would break things: reopening an ongoing tournament would let players
 * join mid-competition; un-completing would change a declared winner.
 */
export const ALLOWED_TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> =
  {
    draft: ['open'],
    open: ['ongoing'],
    ongoing: ['completed'],
    completed: [],
  };

export function canTransition(
  from: TournamentStatus,
  to: TournamentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Only drafts can be deleted: once students joined or played, history must be kept. */
export const canDelete = (status: TournamentStatus) => status === 'draft';

/** The time control is fixed once games can start. */
export const canEditTimeControl = (status: TournamentStatus) =>
  status === 'draft' || status === 'open';

/** Name and start time can change until the tournament is over. */
export const canEditDetails = (status: TournamentStatus) =>
  status !== 'completed';

/** Students never see drafts. */
export const isVisibleToStudents = (status: TournamentStatus) =>
  status !== 'draft';

/** Matchmaking needs at least two players. */
export const MIN_PLAYERS_TO_START = 2;
