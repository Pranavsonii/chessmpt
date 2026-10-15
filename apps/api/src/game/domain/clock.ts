/**
 * Chess clock maths. Pure functions: `now` is always passed in, so tests can
 * control time and nothing here reads the system clock.
 *
 * Model: we never store a ticking counter. We store each side's remaining ms as of
 * the moment the current turn started (`turnStartedAt`). The side to move's real
 * remaining time is computed on demand: stored - (now - turnStartedAt).
 */

export type Side = 'white' | 'black';

export const otherSide = (side: Side): Side =>
  side === 'white' ? 'black' : 'white';

/**
 * Before White's first move no clock runs (players may still be loading the page).
 * If White hasn't moved within this window, the game is aborted with no result.
 */
export const FIRST_MOVE_GRACE_MS = 60_000;

export interface ClockState {
  whiteMs: number;
  blackMs: number;
  incrementMs: number;
  /** Epoch ms when the side to move started thinking; null = clocks not started yet. */
  turnStartedAt: number | null;
}

/** What clients get: remaining time as of `serverNow`, and which clock is ticking. */
export interface ClockView {
  whiteMs: number;
  blackMs: number;
  running: Side | null;
  serverNow: number;
}

/** Remaining ms for `side` at `now`. Only the side to move ticks, and only once started. */
export function timeLeft(
  clock: ClockState,
  side: Side,
  toMove: Side,
  now: number,
): number {
  const stored = side === 'white' ? clock.whiteMs : clock.blackMs;
  if (side !== toMove || clock.turnStartedAt === null) return stored;
  return stored - (now - clock.turnStartedAt);
}

/**
 * The clock after `mover` completes a move at `now` (caller has already checked
 * they weren't out of time): charge the thinking time, add the increment, and
 * start the opponent's clock.
 */
export function clockAfterMove(
  clock: ClockState,
  mover: Side,
  now: number,
): ClockState {
  const left = timeLeft(clock, mover, mover, now) + clock.incrementMs;
  return {
    ...clock,
    whiteMs: mover === 'white' ? left : clock.whiteMs,
    blackMs: mover === 'black' ? left : clock.blackMs,
    turnStartedAt: now,
  };
}

/** Freezes the clock at `now` (game over): the side to move is charged up to now, never below 0. */
export function stopClock(
  clock: ClockState,
  toMove: Side,
  now: number,
): ClockState {
  const left = Math.max(0, timeLeft(clock, toMove, toMove, now));
  return {
    ...clock,
    whiteMs: toMove === 'white' ? left : clock.whiteMs,
    blackMs: toMove === 'black' ? left : clock.blackMs,
    turnStartedAt: null,
  };
}

export function clockView(
  clock: ClockState,
  toMove: Side,
  active: boolean,
  now: number,
): ClockView {
  return {
    whiteMs: Math.max(0, timeLeft(clock, 'white', toMove, now)),
    blackMs: Math.max(0, timeLeft(clock, 'black', toMove, now)),
    running: active && clock.turnStartedAt !== null ? toMove : null,
    serverNow: now,
  };
}
