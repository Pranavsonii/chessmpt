"use client";

import { Badge } from "@/components/ui/badge";
import { useSocket, type SocketStatus } from "@/lib/socket";
import { cn } from "@/lib/utils";

const LABEL: Record<SocketStatus, string> = {
  connecting: "Connecting…",
  connected: "Live",
  disconnected: "Offline",
};

const DOT: Record<SocketStatus, string> = {
  connecting: "bg-amber-500 animate-pulse",
  connected: "bg-emerald-500",
  disconnected: "bg-red-500",
};

/** Small header badge showing the real-time connection state. */
export function SocketStatusBadge() {
  const { status } = useSocket();
  return (
    <Badge variant="outline" className="gap-1.5" title={`Real-time connection: ${status}`}>
      <span className={cn("size-2 rounded-full", DOT[status])} aria-hidden />
      {LABEL[status]}
    </Badge>
  );
}
