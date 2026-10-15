"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./api/client";
import type { MatchHistoryItem, MatchTermination, Outcome, Schedule } from "./api/types";
import { queryKeys } from "./query-keys";

/** Joined tournaments that haven't finished + the game in progress, if any. */
export function useSchedule() {
  return useQuery({
    queryKey: queryKeys.player.schedule,
    queryFn: () => apiFetch<Schedule>("/me/schedule"),
  });
}

export function useMatchHistory() {
  return useQuery({
    queryKey: queryKeys.player.matches,
    queryFn: () => apiFetch<MatchHistoryItem[]>("/me/matches"),
  });
}

export const TERMINATION_LABEL: Record<MatchTermination, string> = {
  checkmate: "Checkmate",
  resignation: "Resignation",
  timeout: "Time out",
  stalemate: "Stalemate",
  insufficient_material: "Insufficient material",
  threefold_repetition: "Threefold repetition",
  fifty_move_rule: "50-move rule",
  draw_agreement: "Draw agreed",
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  win: "Win",
  loss: "Loss",
  draw: "Draw",
};
