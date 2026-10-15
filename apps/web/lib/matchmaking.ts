"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api/client";
import type { QueueStatus } from "./api/types";
import { queryKeys } from "./query-keys";

const path = (tournamentId: string) => `/tournaments/${encodeURIComponent(tournamentId)}/queue`;

/** How often to re-check while searching. The socket push (Phase 7) makes this a fallback. */
const POLL_WHILE_SEARCHING_MS = 2_000;

export function useQueueStatus(tournamentId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.player.queue(tournamentId),
    queryFn: () => apiFetch<QueueStatus>(path(tournamentId)),
    enabled,
    refetchInterval: (query) =>
      query.state.data?.state === "searching" ? POLL_WHILE_SEARCHING_MS : false,
  });
}

/** "Find opponent": the response already says "matched" if someone was waiting. */
export function useFindOpponent(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<QueueStatus>(path(tournamentId), { method: "POST" }),
    onSuccess: (status) => qc.setQueryData(queryKeys.player.queue(tournamentId), status),
  });
}

export function useCancelSearch(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>(path(tournamentId), { method: "DELETE" }),
    onSuccess: () =>
      qc.setQueryData<QueueStatus>(queryKeys.player.queue(tournamentId), { state: "idle" }),
  });
}
