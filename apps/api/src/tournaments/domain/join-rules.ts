import type { TournamentStatus, UserRole } from '../../db/schema';

export type JoinDecision =
  | { ok: true }
  | { ok: false; status: 403 | 404 | 409; code: string; message: string };

/**
 * May this user join this tournament right now? Pure: no DB, no Nest, easy to test.
 * Checked in order, so the user gets the most useful reason first.
 */
export function checkCanJoin(input: {
  role: UserRole;
  status: TournamentStatus;
  alreadyJoined: boolean;
}): JoinDecision {
  if (input.role !== 'student') {
    return {
      ok: false,
      status: 403,
      code: 'ONLY_STUDENTS_CAN_JOIN',
      message: 'Only students can join tournaments',
    };
  }

  // Drafts are invisible to students: behave exactly as if it didn't exist.
  if (input.status === 'draft') {
    return {
      ok: false,
      status: 404,
      code: 'TOURNAMENT_NOT_FOUND',
      message: 'Tournament not found',
    };
  }

  if (input.alreadyJoined) {
    return {
      ok: false,
      status: 409,
      code: 'ALREADY_JOINED',
      message: 'You have already joined this tournament',
    };
  }

  if (input.status !== 'open') {
    return {
      ok: false,
      status: 409,
      code: 'TOURNAMENT_NOT_OPEN',
      message:
        input.status === 'ongoing'
          ? 'Registration is closed: this tournament has already started'
          : 'Registration is closed: this tournament has finished',
    };
  }

  return { ok: true };
}
