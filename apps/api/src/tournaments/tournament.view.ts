import type {
  Match,
  MatchResult,
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

/**
 * GET /tournaments/:id/leaderboard. Points are in half-points and Sonneborn-Berger
 * in quarter-points (integers, exact); the client divides for display.
 */
export interface LeaderboardView {
  tournamentId: string;
  /** True once the tournament is completed: the order is final. */
  final: boolean;
  rows: StandingRow[];
  /** Rank-1 players once final: one winner, or co-winners on a shared first place. */
  winners: { id: string; name: string }[];
}

/** One game in GET /tournaments/:id/matches (coach stats). */
export interface TournamentMatchView {
  id: string;
  white: { id: string; name: string };
  black: { id: string; name: string };
  status: Match['status'];
  result: MatchResult | null;
  termination: MatchTermination | null;
  plies: number;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  pgn: string | null;
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
