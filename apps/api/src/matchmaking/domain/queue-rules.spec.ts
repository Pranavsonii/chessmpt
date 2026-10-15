import { checkCanQueue } from './queue-rules';

const ok = {
  status: 'ongoing' as const,
  isParticipant: true,
  activeMatchId: null,
};

describe('checkCanQueue', () => {
  it('lets a participant queue in an ongoing tournament', () => {
    expect(checkCanQueue(ok)).toEqual({ ok: true });
  });

  it('hides drafts (404)', () => {
    expect(checkCanQueue({ ...ok, status: 'draft' })).toMatchObject({
      status: 404,
      code: 'TOURNAMENT_NOT_FOUND',
    });
  });

  it('requires joining first (403)', () => {
    expect(checkCanQueue({ ...ok, isParticipant: false })).toMatchObject({
      status: 403,
      code: 'NOT_A_PARTICIPANT',
    });
  });

  it('refuses a player who is already in a game, and says which one (409)', () => {
    expect(checkCanQueue({ ...ok, activeMatchId: 'm1' })).toMatchObject({
      status: 409,
      code: 'ALREADY_IN_MATCH',
      details: { matchId: 'm1' },
    });
  });

  it.each(['open', 'completed'] as const)(
    'refuses a %s tournament (409)',
    (status) => {
      expect(checkCanQueue({ ...ok, status })).toMatchObject({
        status: 409,
        code: 'TOURNAMENT_NOT_ONGOING',
      });
    },
  );
});
