"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiFetch } from "./api/client";
import type { User } from "./api/types";
import { queryKeys } from "./query-keys";
import { homeFor, safeNextPath } from "./session";

/** The logged-in user. Cached app-wide; fetched once per session. */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => apiFetch<User>("/me"),
    staleTime: 5 * 60_000,
  });
}

export function useLogin(next?: string | null) {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      apiFetch<User>("/auth/login", { method: "POST", body: input, redirectOn401: false }),
    onSuccess: (user) => {
      qc.clear(); // nothing from a previous account may leak into this session
      qc.setQueryData(queryKeys.me, user); // no extra /me round-trip
      const target = safeNextPath(next);
      // Only follow ?next= if it belongs to this user's area.
      router.replace(target?.startsWith(homeFor(user.role)) ? target : homeFor(user.role));
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => apiFetch<void>("/auth/logout", { method: "POST", redirectOn401: false }),
    onSettled: () => {
      qc.clear();
      router.replace("/login");
    },
  });
}
