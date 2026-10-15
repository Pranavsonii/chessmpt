import {
  type ClockState,
  clockAfterMove,
  clockView,
  stopClock,
  timeLeft,
} from './clock';

const T0 = 1_000_000;
const clock = (over: Partial<ClockState> = {}): ClockState => ({
  whiteMs: 60_000,
  blackMs: 60_000,
  incrementMs: 2_000,
  turnStartedAt: T0,
  ...over,
});

describe('timeLeft', () => {
  it('ticks only for the side to move', () => {
    expect(timeLeft(clock(), 'white', 'white', T0 + 5_000)).toBe(55_000);
    expect(timeLeft(clock(), 'black', 'white', T0 + 5_000)).toBe(60_000);
  });

  it('does not tick before the clock has started', () => {
    const c = clock({ turnStartedAt: null });
    expect(timeLeft(c, 'white', 'white', T0 + 99_000)).toBe(60_000);
  });
});

describe('clockAfterMove', () => {
  it('charges the thinking time, adds the increment and starts the opponent', () => {
    const after = clockAfterMove(clock(), 'white', T0 + 5_000);
    expect(after).toEqual({
      whiteMs: 57_000, // 60s - 5s + 2s increment
      blackMs: 60_000,
      incrementMs: 2_000,
      turnStartedAt: T0 + 5_000,
    });
  });

  it("White's first move costs nothing and starts Black's clock", () => {
    const after = clockAfterMove(clock({ turnStartedAt: null }), 'white', T0);
    expect(after.whiteMs).toBe(62_000);
    expect(after.turnStartedAt).toBe(T0);
  });
});

describe('stopClock / clockView', () => {
  it('freezes the side to move, never below zero', () => {
    const stopped = stopClock(clock(), 'white', T0 + 90_000);
    expect(stopped.whiteMs).toBe(0);
    expect(stopped.turnStartedAt).toBeNull();
  });

  it('reports which clock is running', () => {
    expect(clockView(clock(), 'black', true, T0 + 1_000)).toEqual({
      whiteMs: 60_000,
      blackMs: 59_000,
      running: 'black',
      serverNow: T0 + 1_000,
    });
    expect(clockView(clock(), 'black', false, T0).running).toBeNull();
  });
});
