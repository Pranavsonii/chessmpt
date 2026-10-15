/**
 * Types mirrored from the API (apps/api). Kept by hand for now; a shared package
 * or OpenAPI codegen would remove the duplication in a bigger project.
 */

export type Role = "coach" | "student";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorBody;
}

export interface FieldError {
  field: string;
  errors: string[];
}

// ---------------------------------------------------------------- tournaments

export type TournamentStatus = "draft" | "open" | "ongoing" | "completed";

export interface Tournament {
  id: string;
  name: string;
  timeControl: string; // "5+0"
  initialSeconds: number;
  incrementSeconds: number;
  startsAt: string; // ISO, UTC
  status: TournamentStatus;
  participantCount: number;
  winner: { id: string; name: string } | null;
  /** Only sent to students: has the current student joined? */
  isJoined?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  id: string;
  name: string;
  joinedAt: string;
}

// ---------------------------------------------------------------- results

/** One leaderboard line. Integers only: halfPoints ÷ 2, sbQuarters ÷ 4 for display. */
export interface StandingRow {
  rank: number;
  userId: string;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  halfPoints: number;
  sbQuarters: number;
}

export interface Leaderboard {
  tournamentId: string;
  status: TournamentStatus;
  /** Completed: standings can no longer change. */
  final: boolean;
  rows: StandingRow[];
  /** Rank-1 players once final; more than one means co-winners. */
  winners: PlayerRef[];
}

export interface TournamentMatch {
  id: string;
  white: PlayerRef;
  black: PlayerRef;
  status: "active" | "completed" | "aborted";
  result: MatchResult | null;
  termination: MatchTermination | null;
  plies: number;
  startedAt: string;
  endedAt: string | null;
}

// ---------------------------------------------------------------- player (student)

export type Color = "white" | "black";
export type Outcome = "win" | "loss" | "draw";
export type MatchResult = "1-0" | "0-1" | "1/2-1/2";
export type MatchTermination =
  | "checkmate"
  | "resignation"
  | "timeout"
  | "stalemate"
  | "insufficient_material"
  | "threefold_repetition"
  | "fifty_move_rule"
  | "draw_agreement";

export interface PlayerRef {
  id: string;
  name: string;
}

export interface ActiveMatch {
  matchId: string;
  tournament: { id: string; name: string };
  color: Color;
  opponent: PlayerRef;
  startedAt: string;
}

export interface Schedule {
  tournaments: Tournament[];
  activeMatch: ActiveMatch | null;
}

export interface MatchHistoryItem {
  id: string;
  tournament: { id: string; name: string };
  color: Color;
  opponent: PlayerRef;
  status: "completed" | "aborted";
  result: MatchResult | null;
  outcome: Outcome | null;
  termination: MatchTermination | null;
  startedAt: string;
  endedAt: string | null;
}

// ---------------------------------------------------------------- matchmaking

export type QueueStatus =
  | { state: "idle" }
  | { state: "searching"; tournamentId: string; since: string; waiting: number }
  | { state: "matched"; tournamentId: string; matchId: string };

export interface TournamentInput {
  name: string;
  timeControl: string;
  startsAt: string; // ISO with offset
}
