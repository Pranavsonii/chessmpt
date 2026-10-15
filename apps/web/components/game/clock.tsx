"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** 305000 -> "5:05"; under 10s shows tenths: "9.4". */
export function formatClock(ms: number): string {
  const t = Math.max(0, ms);
  if (t < 10_000) return (Math.floor(t / 100) / 10).toFixed(1);
  const totalSeconds = Math.ceil(t / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Displays one side's clock. `ms` is the server's value as of local time `since`;
 * while running we count down from it locally. This is only a display: the server
 * alone decides when a flag falls, and every move re-syncs both clocks.
 */
export function Clock({ ms, running, since }: { ms: number; running: boolean; since: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [running]);

  const left = running ? ms - Math.max(0, now - since) : ms;
  return (
    <span
      role="timer"
      aria-live="off"
      className={cn(
        "rounded-md px-3 py-1.5 font-mono text-xl font-bold tabular-nums tracking-tight transition-colors",
        running ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        left < 10_000 && "bg-destructive text-white",
      )}
    >
      {formatClock(left)}
    </span>
  );
}
