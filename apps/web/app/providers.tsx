"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { isApiError } from "@/lib/api/client";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retry network/5xx blips, but never 4xx: a 403/404 won't fix itself.
        retry: (failureCount, error) =>
          failureCount < 2 &&
          !(isApiError(error) && error.status >= 400 && error.status < 500),
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  // One client per browser tab (useState keeps it stable across re-renders).
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* richColors: success / error / warning each get their own colour and icon.
          closeButton: every toast can be dismissed. offset clears the sticky header. */}
      <Toaster theme="light" richColors closeButton position="top-right" offset={72} visibleToasts={4} />
    </QueryClientProvider>
  );
}
