"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiFetch } from "./api/client";
import type { Leaderboard, TournamentMatch } from "./api/types";
import { queryKeys } from "./query-keys";
import { useSocket } from "./socket";

const enc = encodeURIComponent;

export function useLeaderboard(tournamentId: string) {
  return useQuery({
    queryKey: queryKeys.tournaments.leaderboard(tournamentId),
    queryFn: () => apiFetch<Leaderboard>(`/tournaments/${enc(tournamentId)}/leaderboard`),
  });
}

/** Coach only. */
export function useTournamentMatches(tournamentId: string) {
  return useQuery({
    queryKey: queryKeys.tournaments.matches(tournamentId),
    queryFn: () => apiFetch<TournamentMatch[]>(`/tournaments/${enc(tournamentId)}/matches`),
  });
}

/**
 * Keeps a tournament page live: joins the server's tournament room, and on every
 * `tournament:updated` (a game started or ended, the status changed) refetches the
 * tournament and everything under it: leaderboard, results, participants.
 * Rejoins on reconnect, because a new socket starts in no rooms.
 */
export function useTournamentLive(tournamentId: string) {
  const { socket } = useSocket();
  const qc = useQueryClient();

  useEffect(() => {
    if (!socket) return;
    const watch = () => socket.emit("tournament:watch", { tournamentId });
    const onUpdated = (e: { tournamentId: string }) => {
      if (e.tournamentId !== tournamentId) return;
      void qc.invalidateQueries({ queryKey: queryKeys.tournaments.detail(tournamentId) });
    };

    if (socket.connected) watch();
    socket.on("connect", watch);
    socket.on("tournament:updated", onUpdated);
    return () => {
      socket.off("connect", watch);
      socket.off("tournament:updated", onUpdated);
      if (socket.connected) socket.emit("tournament:unwatch", { tournamentId });
    };
  }, [socket, tournamentId, qc]);
}

// ---------------------------------------------------------------- display
// The API sends exact integers; this is the only place they become fractions.

const FRACTIONS = ["", "¼", "½", "¾"];

/** 5 half-points -> "2½", 1 -> "½", 0 -> "0". */
export const formatPoints = (halfPoints: number) => formatQuarters(halfPoints * 2);

/** Sonneborn-Berger: 5 quarter-points -> "1¼". */
export function formatQuarters(quarters: number): string {
  const whole = Math.floor(quarters / 4);
  const frac = FRACTIONS[quarters % 4];
  if (whole === 0 && frac) return frac;
  return `${whole}${frac}`;
}
