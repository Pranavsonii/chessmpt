import { Chess } from 'chess.js';
import { FIRST_MOVE_GRACE_MS } from './clock';
import {
  applyMove,
  deadline,
  detectEnd,
  expiry,
  type LiveGame,
} from './live-game';

const T0 = 1_000_000;
const W = 'white-user';
const B = 'black-user';

function newGame(over: Partial<LiveGame> = {}): LiveGame {
  return {
    matchId: 'm1',
    tournamentId: 't1',
    tournamentName: 'Test Cup',
    white: { id: W, name: 'White' },
    black: { id: B, name: 'Black' },
    chess: new Chess(),
    clock: {
      whiteMs: 60_000,
      blackMs: 60_000,
      incrementMs: 0,
      turnStartedAt: null,
    },
    startedAt: T0,
    ply: 0,
    status: 'active',
    result: null,
    termination: null,
    ...over,
  };
}

/** Plays from/to moves alternately, one second apart. */
function play(game: LiveGame, moves: string[], start = T0) {
  moves.forEach((m, i) => {
    const user = game.chess.turn() === 'w' ? W : B;
    const r = applyMove(
      game,
      user,
      { from: m.slice(0, 2), to: m.slice(2, 4), ply: game.ply + 1 },
      start + (i + 1) * 1_000,
    );
    if (!r.ok) throw new Error(`${m} rejected: ${r.code}`);
  });
}

describe('applyMove: rejections', () => {
  it('rejects a non-player', () => {
    const r = applyMove(
      newGame(),
      'stranger',
      { from: 'e2', to: 'e4', ply: 1 },
      T0,
    );
    expect(r).toEqual({ ok: false, code: 'NOT_A_PLAYER' });
  });

  it('rejects moving out of turn', () => {
    const r = applyMove(newGame(), B, { from: 'e7', to: 'e5', ply: 1 }, T0);
    expect(r).toEqual({ ok: false, code: 'NOT_YOUR_TURN' });
  });

  it('rejects a duplicate / out-of-order ply', () => {
    const game = newGame();
    play(game, ['e2e4']);
    const r = applyMove(game, B, { from: 'e7', to: 'e5', ply: 1 }, T0 + 2_000);
    expect(r).toEqual({ ok: false, code: 'STALE_PLY' });
  });

  it('rejects an illegal move and leaves the game untouched', () => {
    const game = newGame();
    const r = applyMove(game, W, { from: 'e2', to: 'e5', ply: 1 }, T0);
    expect(r).toEqual({ ok: false, code: 'ILLEGAL_MOVE' });
    expect(game.ply).toBe(0);
    expect(game.chess.history()).toEqual([]);
  });

  it('rejects any move once the game is over', () => {
    const r = applyMove(
      newGame({ status: 'completed' }),
      W,
      { from: 'e2', to: 'e4', ply: 1 },
      T0,
    );
    expect(r).toEqual({ ok: false, code: 'GAME_OVER' });
  });
});

describe('applyMove: clocks and time', () => {
  it('accepts a legal move, advances the ply and starts the opponent clock', () => {
    const game = newGame();
    const r = applyMove(game, W, { from: 'e2', to: 'e4', ply: 1 }, T0 + 500);
    expect(r).toMatchObject({ ok: true, move: { san: 'e4' }, end: null });
    expect(game.ply).toBe(1);
    expect(game.clock.turnStartedAt).toBe(T0 + 500);
  });

  it('a move arriving after the flag fell loses on time instead of counting', () => {
    const game = newGame();
    play(game, ['e2e4']); // black's clock starts at T0 + 1s
    const r = applyMove(game, B, { from: 'e7', to: 'e5', ply: 2 }, T0 + 61_001);
    expect(r).toEqual({
      ok: false,
      code: 'GAME_OVER',
      end: { kind: 'result', result: '1-0', termination: 'timeout' },
    });
    expect(game.chess.history()).toEqual(['e4']); // the late move was not applied
  });

  it('aborts when White never makes a first move', () => {
    const game = newGame();
    expect(deadline(game)).toBe(T0 + FIRST_MOVE_GRACE_MS);
    expect(expiry(game, T0 + FIRST_MOVE_GRACE_MS - 1)).toBeNull();
    expect(expiry(game, T0 + FIRST_MOVE_GRACE_MS)).toEqual({ kind: 'aborted' });
  });

  it('the deadline after a move is when the side to move flags', () => {
    const game = newGame();
    play(game, ['e2e4']);
    expect(deadline(game)).toBe(T0 + 1_000 + 60_000);
  });
});

describe('game endings', () => {
  it("detects checkmate for the side that delivered it (fool's mate)", () => {
    const game = newGame();
    play(game, ['f2f3', 'e7e5', 'g2g4']);
    const r = applyMove(game, B, { from: 'd8', to: 'h4', ply: 4 }, T0 + 5_000);
    expect(r).toMatchObject({
      ok: true,
      end: { kind: 'result', result: '0-1', termination: 'checkmate' },
    });
  });

  it('detects stalemate', () => {
    // Black king a8 has no legal move and is not in check; Black to move.
    const chess = new Chess('k7/8/1Q6/8/8/8/8/7K b - - 0 1');
    expect(detectEnd(chess)).toEqual({
      kind: 'result',
      result: '1/2-1/2',
      termination: 'stalemate',
    });
  });

  it('detects insufficient material', () => {
    const chess = new Chess('8/8/8/4k3/8/8/8/4K3 w - - 0 1');
    expect(detectEnd(chess)).toMatchObject({
      termination: 'insufficient_material',
    });
  });

  it('detects threefold repetition', () => {
    const game = newGame();
    play(game, ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1']);
    const r = applyMove(game, B, { from: 'f6', to: 'g8', ply: 8 }, T0 + 9_000);
    expect(r).toMatchObject({
      ok: true,
      end: { termination: 'threefold_repetition' },
    });
  });

  it('detects the fifty-move rule', () => {
    // Halfmove clock already at 99: one more quiet move makes 100.
    const chess = new Chess('8/8/8/4k3/8/8/4R3/4K3 w - - 99 80');
    chess.move('Ra2');
    expect(detectEnd(chess)).toMatchObject({ termination: 'fifty_move_rule' });
  });

  it('returns null for an ordinary position', () => {
    expect(detectEnd(new Chess())).toBeNull();
  });
});
