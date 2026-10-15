"use client";

import { toast } from "sonner";
import { isApiError } from "./api/client";

/** Errors stay up long enough to read (and can be closed); successes get out of the way. */
const ERROR_MS = 8_000;
const SUCCESS_MS = 4_000;

/** A short, type-specific heading so the kind of failure is clear at a glance. */
function titleFor(error: unknown, fallback: string): string {
  if (!isApiError(error)) return fallback;
  if (error.status === 0) return "You're offline";
  if (error.status === 401) return "Please log in again";
  if (error.status === 403) return "Not allowed";
  if (error.status === 404) return "Not found";
  if (error.status === 409 || error.status === 422) return fallback;
  if (error.status === 429) return "Slow down";
  if (error.status >= 500) return "Server problem";
  return fallback;
}

/** Shows a failed action as a red, dismissible toast: "<what failed>" + the server's reason. */
export function notifyError(error: unknown, fallback = "Something went wrong") {
  const description = isApiError(error)
    ? error.message
    : typeof error === "string"
      ? error
      : "Please try again.";
  toast.error(titleFor(error, fallback), {
    description,
    duration: ERROR_MS,
    // The same failure twice replaces the toast instead of stacking duplicates.
    id: isApiError(error) ? `err:${error.code}` : undefined,
  });
}

export function notifySuccess(message: string) {
  toast.success(message, { duration: SUCCESS_MS });
}
