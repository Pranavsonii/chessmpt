"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiFetch } from "./api/client";
import type {
  Leaderboard,
  Participant,
  Tournament,
  TournamentInput,
  TournamentMatch,
  TournamentStatus,
} from "./api/types";
import { queryKeys } from "./query-keys";
import { emitWithAck, useSocket } from "./socket";

const enc = encodeURIComponent;

// ------------------------------------------------------------- queries

export function useTournaments(statuses?: TournamentStatus[], opts: { joined?: boolean } = {}) {
  const params = new URLSearchParams();
  if (statuses?.length) params.set("status", statuses.join(","));
  if (opts.joined) params.set("joined", "true");
  const qs = params.size ? `?${params}` : "";
  return useQuery({
    queryKey: [...queryKeys.tournaments.list(statuses), opts.joined ? "joined" : "any"],
    queryFn: () => apiFetch<Tournament[]>(`/tournaments${qs}`),
  });
}

export function useTournament(id: string) {
  return useQuery({
    queryKey: queryKeys.tournaments.detail(id),
    queryFn: () => apiFetch<Tournament>(`/tournaments/${enc(id)}`),
  });
}

export function useParticipants(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tournaments.participants(id),
    queryFn: () => apiFetch<Participant[]>(`/tournaments/${enc(id)}/participants`),
    enabled,
  });
}

export function useLeaderboard(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tournaments.leaderboard(id),
    queryFn: () => apiFetch<Leaderboard>(`/tournaments/${enc(id)}/leaderboard`),
    enabled,
  });
}

export function useTournamentMatches(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tournaments.matches(id),
    queryFn: () => apiFetch<TournamentMatch[]>(`/tournaments/${enc(id)}/matches`),
    enabled,
  });
}

/**
 * Live updates for a tournament page. Joins the server room tournament:{id}; every
 * `tournament:updated` (a game started or ended, the status changed) refetches the
 * tournament and everything under it (participants, leaderboard, matches) over REST.
 * The socket event is only a nudge: REST stays the single source of truth.
 */
export function useWatchTournament(id: string) {
  const { socket } = useSocket();
  const qc = useQueryClient();

  useEffect(() => {
    if (!socket) return;
    // Lists too: a status change moves the tournament between them.
    const refresh = () => qc.invalidateQueries({ queryKey: queryKeys.tournaments.all });
    const watch = () => void emitWithAck(socket, "tournament:watch", { tournamentId: id });
    // Rooms belong to a socket connection, so a reconnect has to join again. Events
    // sent while we were offline are lost, so refetch once as well.
    const onReconnect = () => {
      watch();
      void refresh();
    };
    const onUpdated = (e: { tournamentId: string }) => {
      if (e.tournamentId === id) void refresh();
    };

    if (socket.connected) watch();
    socket.on("connect", onReconnect);
    socket.on("tournament:updated", onUpdated);
    return () => {
      socket.off("connect", onReconnect);
      socket.off("tournament:updated", onUpdated);
      if (socket.connected) socket.emit("tournament:unwatch", { tournamentId: id });
    };
  }, [socket, id, qc]);
}

// ------------------------------------------------------------- mutations (coach)
// After every successful write, invalidate ["tournaments"]: all lists, details and
// participant lists refetch, so every screen shows the new state without a reload.

function useInvalidateTournaments() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.tournaments.all });
}

export function useCreateTournament() {
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: (input: TournamentInput) =>
      apiFetch<Tournament>("/tournaments", { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateTournament(id: string) {
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: (input: Partial<TournamentInput>) =>
      apiFetch<Tournament>(`/tournaments/${enc(id)}`, { method: "PATCH", body: input }),
    onSuccess: invalidate,
  });
}

export function useChangeTournamentStatus(id: string) {
  const invalidate = useInvalidateTournaments();
  return useMutation({
    mutationFn: (status: TournamentStatus) =>
      apiFetch<Tournament>(`/tournaments/${enc(id)}/status`, {
        method: "PATCH",
        body: { status },
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteTournament(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>(`/tournaments/${enc(id)}`, { method: "DELETE" }),
    onSuccess: () => {
      // The detail no longer exists: drop it instead of refetching into a 404.
      qc.removeQueries({ queryKey: queryKeys.tournaments.detail(id) });
      return qc.invalidateQueries({ queryKey: queryKeys.tournaments.all });
    },
  });
}

// ------------------------------------------------------------- join (student)

export function useJoinTournament(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<Tournament>(`/tournaments/${enc(id)}/join`, { method: "POST" }),
    onSuccess: (tournament) => {
      // The response is the fresh tournament: show it immediately, then refresh the rest
      // (lists, participant list, the student's schedule).
      qc.setQueryData(queryKeys.tournaments.detail(id), tournament);
      return Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.tournaments.all }),
        qc.invalidateQueries({ queryKey: queryKeys.player.all }),
      ]);
    },
  });
}

// ------------------------------------------------------------- display helpers

export const STATUS_LABEL: Record<TournamentStatus, string> = {
  draft: "Draft",
  open: "Open",
  ongoing: "Ongoing",
  completed: "Completed",
};

export const TIME_CONTROL_PRESETS = [
  { value: "1+0", label: "1+0 · Bullet" },
  { value: "3+0", label: "3+0 · Blitz" },
  { value: "3+2", label: "3+2 · Blitz" },
  { value: "5+0", label: "5+0 · Blitz" },
  { value: "5+3", label: "5+3 · Blitz" },
  { value: "10+0", label: "10+0 · Rapid" },
  { value: "10+5", label: "10+5 · Rapid" },
  { value: "15+10", label: "15+10 · Rapid" },
] as const;
