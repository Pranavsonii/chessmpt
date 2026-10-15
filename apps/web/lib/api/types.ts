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
