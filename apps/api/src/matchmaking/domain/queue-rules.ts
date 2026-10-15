import type { TournamentStatus } from '../../db/schema';

export type QueueDecision =
  | { ok: true }
  | {
      ok: false;
      status: 403 | 404 | 409;
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };

/** May this student enter this tournament's matchmaking queue right now? Pure. */
export function checkCanQueue(input: {
  status: TournamentStatus;
  isParticipant: boolean;
  activeMatchId: string | null;
}): QueueDecision {
  if (input.status === 'draft') {
    return {
      ok: false,
      status: 404,
      code: 'TOURNAMENT_NOT_FOUND',
      message: 'Tournament not found',
    };
  }

  if (!input.isParticipant) {
    return {
      ok: false,
      status: 403,
      code: 'NOT_A_PARTICIPANT',
      message: 'Join this tournament before looking for an opponent',
    };
  }

  // At most one game at a time: send them back to the game they're already in.
  if (input.activeMatchId) {
    return {
      ok: false,
      status: 409,
      code: 'ALREADY_IN_MATCH',
      message: 'You are already playing a game',
      details: { matchId: input.activeMatchId },
    };
  }

  if (input.status !== 'ongoing') {
    return {
      ok: false,
      status: 409,
      code: 'TOURNAMENT_NOT_ONGOING',
      message:
        input.status === 'open'
          ? 'Matchmaking opens when your coach starts the tournament'
          : 'This tournament has finished',
    };
  }

  return { ok: true };
}
