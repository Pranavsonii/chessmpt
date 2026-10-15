"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Chess } from "chess.js";
import { useCallback, useEffect, useReducer } from "react";
import { toast } from "sonner";
import type { ApiErrorBody, MatchResult, MatchTermination } from "./api/types";
import { queryKeys } from "./query-keys";
import { emitWithAck, useSocket } from "./socket";

// ---------------------------------------------------------------- server payloads
// Mirror apps/api/src/game/match-engine.service.ts.

export type Side = "white" | "black";
export type MatchStatus = "active" | "completed" | "aborted";

export interface PlayerRef {
  id: string;
  name: string;
}

export interface ClockView {
  whiteMs: number;
  blackMs: number;
  running: Side | null;
  serverNow: number;
}

export interface MoveView {
  ply: number;
  san: string;
  from: string;
  to: string;
}

export interface MatchSnapshot {
  matchId: string;
  tournament: { id: string; name: string };
  white: PlayerRef;
  black: PlayerRef;
  status: MatchStatus;
  result: MatchResult | null;
  termination: MatchTermination | null;
  fen: string;
  pgn: string;
  moves: MoveView[];
  turn: Side;
  ply: number;
  clock: ClockView;
  firstMoveDeadline: number | null;
}

interface MovedEvent {
  matchId: string;
  move: MoveView;
  fen: string;
  pgn: string;
  turn: Side;
  ply: number;
  clock: ClockView;
}

interface EndedEvent {
  matchId: string;
  status: "completed" | "aborted";
  result: MatchResult | null;
  termination: MatchTermination | null;
  fen: string;
  pgn: string;
  clock: ClockView;
}

// ---------------------------------------------------------------- state

interface State {
  game: MatchSnapshot | null;
  error: ApiErrorBody | null;
  /** Position shown while our move waits for the server (optimistic update). */
  pendingFen: string | null;
  /** Local Date.now() when `game.clock` arrived; clocks interpolate from here. */
  clockAt: number;
  /** True once we've seen the game end live (opens the result dialog). */
  endedLive: boolean;
}

type Action =
  | { type: "snapshot"; game: MatchSnapshot }
  | { type: "error"; error: ApiErrorBody }
  | { type: "moved"; e: MovedEvent }
  | { type: "ended"; e: EndedEvent }
  | { type: "pending"; fen: string | null };

const initial: State = { game: null, error: null, pendingFen: null, clockAt: 0, endedLive: false };

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case "snapshot":
      return { ...state, game: a.game, error: null, pendingFen: null, clockAt: Date.now() };
    case "error":
      return { ...state, error: a.error };
    case "moved": {
      const g = state.game;
      if (!g || a.e.ply <= g.ply) return state; // duplicate after a resync: already have it
      return {
        ...state,
        pendingFen: null,
        clockAt: Date.now(),
        game: {
          ...g,
          fen: a.e.fen,
          pgn: a.e.pgn,
          turn: a.e.turn,
          ply: a.e.ply,
          clock: a.e.clock,
          moves: [...g.moves, a.e.move],
          firstMoveDeadline: null,
        },
      };
    }
    case "ended": {
      const g = state.game;
      if (!g || g.status !== "active") return state;
      return {
        ...state,
        pendingFen: null,
        clockAt: Date.now(),
        endedLive: true,
        game: {
          ...g,
          status: a.e.status,
          result: a.e.result,
          termination: a.e.termination,
          fen: a.e.fen,
          pgn: a.e.pgn,
          clock: a.e.clock,
          firstMoveDeadline: null,
        },
      };
    }
    case "pending":
      return { ...state, pendingFen: a.fen };
  }
}

// ---------------------------------------------------------------- hook

/**
 * Live state of one match. The server is the only source of truth: we join to get
 * a snapshot, then apply its match:moved / match:ended broadcasts. Our own moves
 * are shown optimistically and replaced by whatever the server says.
 */
export function useLiveMatch(matchId: string, myId: string | undefined) {
  const { socket, status: socketStatus } = useSocket();
  const qc = useQueryClient();
  const [state, dispatch] = useReducer(reducer, initial);

  // (Re)join on mount and on every reconnect: a fresh snapshot is all reconnection needs.
  useEffect(() => {
    if (!socket) return;
    const join = async () => {
      const ack = await emitWithAck<MatchSnapshot>(socket, "match:join", { matchId });
      dispatch(ack.ok ? { type: "snapshot", game: ack.data } : { type: "error", error: ack.error });
    };
    const onMoved = (e: MovedEvent) => e.matchId === matchId && dispatch({ type: "moved", e });
    const onEnded = (e: EndedEvent) => {
      if (e.matchId !== matchId) return;
      dispatch({ type: "ended", e });
      void qc.invalidateQueries({ queryKey: queryKeys.player.all }); // schedule + history
      void qc.invalidateQueries({ queryKey: queryKeys.tournaments.all }); // standings
    };

    if (socket.connected) void join();
    socket.on("connect", join);
    socket.on("match:moved", onMoved);
    socket.on("match:ended", onEnded);
    return () => {
      socket.off("connect", join);
      socket.off("match:moved", onMoved);
      socket.off("match:ended", onEnded);
      if (socket.connected) socket.emit("match:leave", { matchId });
    };
  }, [socket, matchId, qc]);

  const game = state.game;
  const myColor: Side | null =
    game && myId ? (game.white.id === myId ? "white" : game.black.id === myId ? "black" : null) : null;
  const canMove =
    !!game && game.status === "active" && myColor === game.turn && state.pendingFen === null;

  /**
   * Returns false if the move is illegal locally (the piece snaps back). Otherwise
   * shows it at once and sends it; a rejection restores the server position.
   */
  const makeMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      if (!socket || !game || !canMove) return false;
      const local = new Chess(game.fen);
      try {
        local.move({ from, to, promotion });
      } catch {
        return false;
      }
      dispatch({ type: "pending", fen: local.fen() });
      void emitWithAck<{ ply: number }>(socket, "match:move", {
        matchId,
        from,
        to,
        promotion,
        ply: game.ply + 1,
      }).then(async (ack) => {
        if (ack.ok) return; // match:moved carries the new state
        dispatch({ type: "pending", fen: null });
        toast.error(ack.error.message);
        // Our view was stale or the game ended: pull a fresh snapshot.
        const fresh = await emitWithAck<MatchSnapshot>(socket, "match:join", { matchId });
        if (fresh.ok) dispatch({ type: "snapshot", game: fresh.data });
      });
      return true;
    },
    [socket, game, canMove, matchId],
  );

  const resign = useCallback(async () => {
    if (!socket) return;
    const ack = await emitWithAck(socket, "match:resign", { matchId });
    if (!ack.ok) toast.error(ack.error.message);
  }, [socket, matchId]);

  return {
    game,
    error: state.error,
    position: state.pendingFen ?? game?.fen ?? null,
    clockAt: state.clockAt,
    endedLive: state.endedLive,
    myColor,
    canMove,
    socketStatus,
    makeMove,
    resign,
  };
}
