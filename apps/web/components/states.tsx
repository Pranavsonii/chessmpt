"use client";

import { AlertTriangle, Inbox, Lock, RotateCw, SearchX, ServerCrash, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/client";

/**
 * The three states every data-driven screen must handle, so nothing hangs or fails silently.
 * Usage:  if (q.isPending) <LoadingState/>; if (q.isError) <ErrorState error onRetry/>; if (!items.length) <EmptyState/>
 */

export function LoadingState({ rows = 3, label = "Loading…" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Different failures look different: offline is not the same problem as "no access". */
function kindOf(error: unknown) {
  if (!isApiError(error)) return { icon: AlertTriangle, title: "Something went wrong" };
  if (error.status === 0) return { icon: WifiOff, title: "You're offline" };
  if (error.status === 403) return { icon: Lock, title: "You don't have access" };
  if (error.status === 404) return { icon: SearchX, title: "Not found" };
  if (error.status >= 500) return { icon: ServerCrash, title: "The server is having trouble" };
  return { icon: AlertTriangle, title: "Something went wrong" };
}

export function ErrorState({
  error,
  onRetry,
  title,
}: {
  error: unknown;
  onRetry?: () => void;
  /** Overrides the heading (e.g. "Couldn't load tournaments"). */
  title?: string;
}) {
  const kind = kindOf(error);
  const Icon = kind.icon;
  const message = isApiError(error)
    ? error.message
    : "An unexpected error occurred. Please try again.";
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center"
    >
      <Icon className="size-8 text-destructive" aria-hidden />
      <div>
        <p className="font-semibold">{title ?? kind.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        {isApiError(error) && (
          // A code people can quote when they report a problem.
          <p className="mt-2 font-mono text-xs text-muted-foreground/80">Error code: {error.code}</p>
        )}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <Icon className="size-8 text-muted-foreground" />
      <div>
        <p className="font-semibold">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
