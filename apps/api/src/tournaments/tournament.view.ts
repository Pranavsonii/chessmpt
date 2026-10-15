import type { Tournament, TournamentStatus } from '../db/schema';
import { formatTimeControl } from './domain/time-control';

/** What the API returns for a tournament. */
export interface TournamentView {
  id: string;
  name: string;
  timeControl: string; // "5+0"
  initialSeconds: number;
  incrementSeconds: number;
  startsAt: string; // ISO, UTC
  status: TournamentStatus;
  participantCount: number;
  winner: { id: string; name: string } | null;
  /** Only present when a student is asking: has THIS student joined? */
  isJoined?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantView {
  id: string;
  name: string;
  joinedAt: string;
}

export function toTournamentView(
  t: Tournament,
  participantCount: number,
  winner: { id: string; name: string } | null,
  isJoined?: boolean,
): TournamentView {
  return {
    ...(isJoined !== undefined && { isJoined }),
    id: t.id,
    name: t.name,
    timeControl: formatTimeControl(t),
    initialSeconds: t.initialSeconds,
    incrementSeconds: t.incrementSeconds,
    startsAt: t.startsAt.toISOString(),
    status: t.status,
    participantCount,
    winner,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}
