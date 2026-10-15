/**
 * Time controls are written "minutes+increment": "5+0" = 5 minutes each, no increment;
 * "5+3" = 5 minutes each, +3 seconds after every move.
 * Stored as two integers (seconds) because the clock logic needs numbers.
 */
export interface TimeControl {
  initialSeconds: number;
  incrementSeconds: number;
}

export const TIME_CONTROL_PATTERN = /^(\d{1,3})\+(\d{1,2})$/;

export const TIME_CONTROL_LIMITS = {
  minMinutes: 1,
  maxMinutes: 180,
  maxIncrementSeconds: 60,
} as const;

/** "5+3" → { initialSeconds: 300, incrementSeconds: 3 }, or null if malformed / out of range. */
export function parseTimeControl(input: string): TimeControl | null {
  const match = TIME_CONTROL_PATTERN.exec(input.trim());
  if (!match) return null;

  const minutes = Number(match[1]);
  const increment = Number(match[2]);
  if (
    minutes < TIME_CONTROL_LIMITS.minMinutes ||
    minutes > TIME_CONTROL_LIMITS.maxMinutes ||
    increment > TIME_CONTROL_LIMITS.maxIncrementSeconds
  ) {
    return null;
  }
  return { initialSeconds: minutes * 60, incrementSeconds: increment };
}

/** { 300, 3 } → "5+3". */
export function formatTimeControl(tc: TimeControl): string {
  return `${tc.initialSeconds / 60}+${tc.incrementSeconds}`;
}
