/**
 * The standard response envelope. Every REST response has exactly one of these shapes.
 *
 *   success: { success: true,  data, meta? }
 *   error:   { success: false, error: { code, message, details? } }
 */
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

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/**
 * Return this from a handler when the response needs `meta` (e.g. list totals).
 * The ResponseInterceptor unwraps it into { data, meta }.
 */
export class WithMeta<T> {
  constructor(
    public readonly data: T,
    public readonly meta: Record<string, unknown>,
  ) {}
}

export const withMeta = <T>(data: T, meta: Record<string, unknown>) =>
  new WithMeta(data, meta);
