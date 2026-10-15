import type { TournamentStatus } from '../../db/schema';
import { checkCanJoin } from './join-rules';

const student = { role: 'student' as const, alreadyJoined: false };

describe('checkCanJoin', () => {
  it('lets a student join an open tournament', () => {
    expect(checkCanJoin({ ...student, status: 'open' })).toEqual({ ok: true });
  });

  it('refuses a coach (403)', () => {
    expect(
      checkCanJoin({ role: 'coach', status: 'open', alreadyJoined: false }),
    ).toMatchObject({ ok: false, status: 403, code: 'ONLY_STUDENTS_CAN_JOIN' });
  });

  it('hides drafts as 404', () => {
    expect(checkCanJoin({ ...student, status: 'draft' })).toMatchObject({
      ok: false,
      status: 404,
      code: 'TOURNAMENT_NOT_FOUND',
    });
  });

  it.each<TournamentStatus>(['ongoing', 'completed'])(
    'refuses joining a %s tournament (409 TOURNAMENT_NOT_OPEN)',
    (status) => {
      expect(checkCanJoin({ ...student, status })).toMatchObject({
        ok: false,
        status: 409,
        code: 'TOURNAMENT_NOT_OPEN',
      });
    },
  );

  it('explains why registration is closed', () => {
    const ongoing = checkCanJoin({ ...student, status: 'ongoing' });
    const completed = checkCanJoin({ ...student, status: 'completed' });
    expect(!ongoing.ok && ongoing.message).toMatch(/already started/);
    expect(!completed.ok && completed.message).toMatch(/finished/);
  });

  it('refuses a second join (409 ALREADY_JOINED)', () => {
    expect(
      checkCanJoin({ ...student, status: 'open', alreadyJoined: true }),
    ).toMatchObject({ ok: false, status: 409, code: 'ALREADY_JOINED' });
  });

  it('says "already joined" rather than "closed" once the tournament started', () => {
    // More useful to the student: they're in, it just started.
    expect(
      checkCanJoin({ ...student, status: 'ongoing', alreadyJoined: true }),
    ).toMatchObject({ code: 'ALREADY_JOINED' });
  });
});
