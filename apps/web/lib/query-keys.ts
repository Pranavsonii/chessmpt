/**
 * Every TanStack Query key in one place, so invalidation after a mutation
 * always targets exactly the keys that the queries use.
 */
export const queryKeys = {
  me: ["me"] as const,
};
