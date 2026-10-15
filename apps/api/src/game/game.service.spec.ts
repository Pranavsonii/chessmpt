import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Database } from '../db/client';
import { GameService } from './game.service';

const match = { id: 'm1', whiteId: 'white', blackId: 'black' };

/** Just enough of the Drizzle client for findFirst. */
const fakeDb = (row: unknown) =>
  ({
    query: { matches: { findFirst: jest.fn().mockResolvedValue(row) } },
  }) as unknown as Database;

describe('GameService.getMatchForParticipant', () => {
  it('returns the match to either player', async () => {
    const service = new GameService(fakeDb(match));
    await expect(
      service.getMatchForParticipant('m1', { id: 'white', role: 'student' }),
    ).resolves.toBe(match);
    await expect(
      service.getMatchForParticipant('m1', { id: 'black', role: 'student' }),
    ).resolves.toBe(match);
  });

  it('rejects anyone else with NOT_A_PARTICIPANT', async () => {
    const service = new GameService(fakeDb(match));
    const attempt = service.getMatchForParticipant('m1', {
      id: 'someone-else',
      role: 'student',
    });
    await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
    await expect(attempt).rejects.toMatchObject({
      response: { code: 'NOT_A_PARTICIPANT' },
    });
  });

  it('reports a missing match as MATCH_NOT_FOUND', async () => {
    const service = new GameService(fakeDb(undefined));
    await expect(
      service.getMatchForParticipant('nope', { id: 'white', role: 'student' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
