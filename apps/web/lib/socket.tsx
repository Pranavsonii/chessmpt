"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ApiErrorBody } from "./api/types";

export type SocketStatus = "connecting" | "connected" | "disconnected";

/** Mirrors Ack in apps/api/src/game/ws-ack.ts. */
export type Ack<T> = { ok: true; data: T } | { ok: false; error: ApiErrorBody };

interface SocketState {
  socket: Socket | null;
  status: SocketStatus;
}

const SocketContext = createContext<SocketState>({ socket: null, status: "disconnected" });

/**
 * One Socket.IO connection per logged-in session, mounted by AppShell (so it opens
 * after login and closes on logout when the shell unmounts).
 *
 * It connects straight to the API origin, not through the Next rewrite (rewrites
 * don't proxy WebSockets reliably). The auth cookie still goes along: cookies are
 * scoped by host, not port, and `withCredentials` makes the browser attach it.
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  // Created once, but only connected in the effect (never during render).
  const [socket] = useState(() =>
    io(`${process.env.NEXT_PUBLIC_SOCKET_URL}/game`, {
      autoConnect: false,
      withCredentials: true,
      transports: ["websocket"], // skip the long-polling warm-up; we only target modern browsers
    }),
  );
  const [status, setStatus] = useState<SocketStatus>("connecting");

  useEffect(() => {
    // `active` is false once Socket.IO has given up, e.g. the server rejected the
    // handshake (UNAUTHORIZED): it does not retry that by itself.
    const sync = () =>
      setStatus(socket.connected ? "connected" : socket.active ? "connecting" : "disconnected");

    socket.on("connect", sync);
    socket.on("connect_error", sync);
    socket.on("disconnect", sync);
    socket.io.on("reconnect_attempt", sync);
    socket.connect();

    return () => {
      socket.off("connect", sync);
      socket.off("connect_error", sync);
      socket.off("disconnect", sync);
      socket.io.off("reconnect_attempt", sync);
      socket.disconnect();
    };
  }, [socket]);

  const value = useMemo(() => ({ socket, status }), [socket, status]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);

/**
 * Emit with an acknowledgement, as a promise. A dead connection or a server that
 * never answers resolves to a TIMEOUT error instead of hanging forever.
 */
export async function emitWithAck<T>(
  socket: Socket,
  event: string,
  payload?: unknown,
  timeoutMs = 5_000,
): Promise<Ack<T>> {
  try {
    return (await socket.timeout(timeoutMs).emitWithAck(event, payload)) as Ack<T>;
  } catch {
    return { ok: false, error: { code: "TIMEOUT", message: "The server did not respond" } };
  }
}
