import type {
  MatchResult,
  MatchStatus,
  MatchTermination,
  Tournament,
  TournamentStatus,
} from '../db/schema';
import type { StandingRow } from './domain/standings';
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

/** GET /tournaments/:id/leaderboard */
export interface LeaderboardView {
  tournamentId: string;
  status: TournamentStatus;
  /** True once the tournament is completed: the standings can no longer change. */
  final: boolean;
  /** Integers only: halfPoints ÷ 2 and sbQuarters ÷ 4 for display. */
  rows: StandingRow[];
  /** Rank-1 players once final (more than one = co-winners); empty before that. */
  winners: { id: string; name: string }[];
}

/** GET /tournaments/:id/matches: one row per game, newest first. */
export interface TournamentMatchView {
  id: string;
  white: { id: string; name: string };
  black: { id: string; name: string };
  status: MatchStatus;
  result: MatchResult | null;
  termination: MatchTermination | null;
  /** Half-moves played. */
  plies: number;
  startedAt: string;
  endedAt: string | null;
}
