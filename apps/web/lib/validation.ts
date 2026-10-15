/**
 * Client-side validation, mirroring the API's DTO rules (apps/api/src/**\/dto).
 *
 * This is for fast, friendly feedback only: the API validates everything again,
 * and its answer always wins. Each validator returns an error message, or null.
 */

export type Validator = (value: string) => string | null;

// Pragmatic email shape check (the API uses class-validator's IsEmail).
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateEmail: Validator = (v) => {
  const value = v.trim();
  if (!value) return "Enter your email address";
  if (value.length > 255) return "That email is too long";
  if (!EMAIL.test(value)) return "Enter a valid email address, like name@example.com";
  return null;
};

export const validatePassword: Validator = (v) => {
  if (!v) return "Enter your password";
  if (v.length < 6) return "Passwords are at least 6 characters";
  if (v.length > 128) return "Passwords are at most 128 characters";
  return null;
};

/** Same allow-list as TOURNAMENT_NAME_PATTERN in the API (no quotes, brackets or control characters). */
const TOURNAMENT_NAME = /^[\p{L}\p{M}\p{N} .,'&()!?:#+/-]+$/u;

export const validateTournamentName: Validator = (v) => {
  const value = v.trim();
  if (!value) return "Give the tournament a name";
  if (value.length < 3) return "Use at least 3 characters";
  if (value.length > 120) return "Use at most 120 characters";
  if (!TOURNAMENT_NAME.test(value))
    return "Use letters, numbers, spaces and . , ' & ( ) ! ? : # + / - only";
  return null;
};

/** "minutes+increment": 1–180 minutes, 0–60 seconds (TIME_CONTROL_LIMITS in the API). */
export const validateTimeControl: Validator = (v) => {
  const match = /^(\d{1,3})\+(\d{1,2})$/.exec(v.trim());
  if (!match) return 'Write it as minutes+increment, e.g. "7+2"';
  const [minutes, increment] = [Number(match[1]), Number(match[2])];
  if (minutes < 1 || minutes > 180) return "Minutes must be between 1 and 180";
  if (increment > 60) return "The increment must be 0–60 seconds";
  return null;
};

const HOUR = 3600_000;

/** A datetime-local value (read as IST by the caller), within the API's window. */
export function validateStartsAt(iso: string, { allowPast }: { allowPast: boolean }): string | null {
  const t = new Date(iso).getTime();
  if (!iso || Number.isNaN(t)) return "Pick a start date and time";
  if (!allowPast && t < Date.now() - HOUR) return "The start time can't be in the past";
  if (t > Date.now() + 366 * 24 * HOUR) return "Pick a start time within the next year";
  return null;
}

/** Runs every validator and returns only the failing fields. */
export function collectErrors<K extends string>(
  checks: Record<K, string | null>,
): Partial<Record<K, string>> {
  return Object.fromEntries(
    Object.entries(checks).filter(([, msg]) => msg !== null),
  ) as Partial<Record<K, string>>;
}
