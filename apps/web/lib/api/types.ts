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
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  id: string;
  name: string;
  joinedAt: string;
}

export interface TournamentInput {
  name: string;
  timeControl: string;
  startsAt: string; // ISO with offset
}
