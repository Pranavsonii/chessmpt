/**
 * Every TanStack Query key in one place, so invalidation after a mutation
 * always targets exactly the keys that the queries use.
 *
 * Keys are hierarchical: invalidating ["tournaments"] also refreshes every list,
 * detail and participants query underneath it.
 */
export const queryKeys = {
  me: ["me"] as const,
  tournaments: {
    all: ["tournaments"] as const,
    list: (statuses?: readonly string[]) =>
      ["tournaments", "list", statuses?.join(",") ?? "all"] as const,
    detail: (id: string) => ["tournaments", "detail", id] as const,
    participants: (id: string) => ["tournaments", "detail", id, "participants"] as const,
    leaderboard: (id: string) => ["tournaments", "detail", id, "leaderboard"] as const,
    matches: (id: string) => ["tournaments", "detail", id, "matches"] as const,
  },
  player: {
    all: ["player"] as const,
    schedule: ["player", "schedule"] as const,
    matches: ["player", "matches"] as const,
    queue: (tournamentId: string) => ["player", "queue", tournamentId] as const,
  },
};
