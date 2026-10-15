import type { ApiFailure, ApiSuccess, FieldError } from "./types";

/** Every failed request becomes one of these, so the UI can switch on `code` / `status`. */
export class ApiError extends Error {
  constructor(
    public readonly status: number, // 0 = never reached the server
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Field-level messages from a 400 VALIDATION_ERROR, keyed by field name. */
  get fieldErrors(): Record<string, string> {
    if (this.code !== "VALIDATION_ERROR" || !Array.isArray(this.details)) return {};
    return Object.fromEntries(
      (this.details as FieldError[]).map((f) => [f.field, f.errors[0] ?? "Invalid"]),
    );
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

const BASE = "/api/v1"; // same origin; next.config.ts rewrites it to the NestJS API

interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /**
   * On 401, clear the session and send the user to /login (default true).
   * The login request itself turns this off: a 401 there just means "wrong password".
   */
  redirectOn401?: boolean;
}

/**
 * The one place the frontend talks to the REST API.
 * Unwraps the { success, data } envelope and throws ApiError for anything else.
 */
export async function apiFetch<T>(
  path: string,
  { body, redirectOn401 = true, headers, ...init }: ApiFetchOptions = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: "include", // send the httpOnly auth cookie
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach the server. Check your connection.");
  }

  if (res.status === 204) return undefined as T;

  const json = (await res.json().catch(() => null)) as ApiSuccess<T> | ApiFailure | null;

  if (res.ok && json?.success) return json.data;

  const error =
    json && !json.success
      ? new ApiError(res.status, json.error.code, json.error.message, json.error.details)
      : new ApiError(
          res.status,
          res.status >= 500 ? "SERVER_UNAVAILABLE" : "UNEXPECTED_RESPONSE",
          res.status >= 500
            ? "The server is unavailable right now. Please try again shortly."
            : "Unexpected response from the server.",
        );

  if (res.status === 401 && redirectOn401) await handleSessionExpired();
  throw error;
}

let redirecting = false;

/**
 * Valid-looking cookie, but the API says no (expired, account deleted...).
 * Clear the cookie first; otherwise proxy.ts would bounce /login back to the app.
 */
async function handleSessionExpired() {
  if (typeof window === "undefined" || redirecting) return;
  redirecting = true;
  await fetch(`${BASE}/auth/logout`, { method: "POST", credentials: "include" }).catch(
    () => undefined,
  );
  const next = encodeURIComponent(window.location.pathname);
  // A full reload on purpose: wipes every in-memory cache (queries, sockets) from the old session.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?next=${next}&expired=1`);
}
