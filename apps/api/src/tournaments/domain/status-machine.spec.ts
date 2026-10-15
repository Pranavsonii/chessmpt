import type { TournamentStatus } from '../../db/schema';
import {
  canDelete,
  canEditDetails,
  canEditTimeControl,
  canTransition,
  isVisibleToStudents,
} from './status-machine';

const ALL: TournamentStatus[] = ['draft', 'open', 'ongoing', 'completed'];

describe('tournament status machine', () => {
  const allowed: [TournamentStatus, TournamentStatus][] = [
    ['draft', 'open'],
    ['open', 'ongoing'],
    ['ongoing', 'completed'],
  ];

  it.each(allowed)('allows %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  // Every other pair (backwards, skipping a step, staying put) is forbidden.
  const forbidden = ALL.flatMap((from) =>
    ALL.map((to) => [from, to] as [TournamentStatus, TournamentStatus]),
  ).filter(([f, t]) => !allowed.some(([af, at]) => af === f && at === t));

  it.each(forbidden)('forbids %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('only drafts can be deleted', () => {
    expect(ALL.filter(canDelete)).toEqual(['draft']);
  });

  it('time control is editable only before games can start', () => {
    expect(ALL.filter(canEditTimeControl)).toEqual(['draft', 'open']);
  });

  it('details are editable until completed', () => {
    expect(ALL.filter(canEditDetails)).toEqual(['draft', 'open', 'ongoing']);
  });

  it('students never see drafts', () => {
    expect(ALL.filter(isVisibleToStudents)).toEqual([
      'open',
      'ongoing',
      'completed',
    ]);
  });
});
