"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api/client";
import type {
  Participant,
  Tournament,
  TournamentInput,
  TournamentStatus,
} from "./api/types";
import { queryKeys } from "./query-keys";

const enc = encodeURIComponent;

// ------------------------------------------------------------- queries

export function useTournaments(statuses?: TournamentStatus[]) {
  const qs = statuses?.length ? `?status=${statuses.join(",")}` : "";
  return useQuery({
    queryKey: queryKeys.tournaments.list(statuses),
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
