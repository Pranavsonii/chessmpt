"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Swords, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isApiError } from "@/lib/api/client";
import type { QueueStatus, Tournament } from "@/lib/api/types";
import { useCancelSearch, useFindOpponent, useQueueStatus } from "@/lib/matchmaking";
import { queryKeys } from "@/lib/query-keys";
import { useSocket } from "@/lib/socket";
import { notifyError } from "@/lib/notify";

/**
 * "Find opponent" for a joined student in an ongoing tournament.
 * idle → searching (elapsed time, players waiting, Cancel) → matched → straight to the board.
 */
export function FindOpponentCard({ tournament }: { tournament: Tournament }) {
  const router = useRouter();
  const qc = useQueryClient();
  const status = useQueueStatus(tournament.id, true);
  const find = useFindOpponent(tournament.id);
  const cancel = useCancelSearch(tournament.id);
  const { socket } = useSocket();
  const current = status.data;

  // The socket push is the fast path; polling while searching stays as the fallback.
  useEffect(() => {
    if (!socket) return;
    const onFound = (e: { matchId: string; tournamentId: string }) => {
      if (e.tournamentId !== tournament.id) return;
      const matched: QueueStatus = {
        state: "matched",
        tournamentId: e.tournamentId,
        matchId: e.matchId,
      };
      qc.setQueryData(queryKeys.player.queue(tournament.id), matched);
    };
    socket.on("match:found", onFound);
    return () => {
      socket.off("match:found", onFound);
    };
  }, [socket, qc, tournament.id]);

  // Matched (from the POST response, a poll, or the socket push): go play.
  const matchId = current?.state === "matched" ? current.matchId : null;
  useEffect(() => {
    if (!matchId) return;
    toast.success("Opponent found! Good luck ♟");
    void qc.invalidateQueries({ queryKey: queryKeys.player.all }); // schedule / active game banner
    router.push(`/student/play/${matchId}`);
  }, [matchId, qc, router]);

  function onFind() {
    find.mutate(undefined, {
      onError: (err) => {
        // Already in a game (e.g. another tab found one): send them to it.
        const existing =
          isApiError(err) && err.code === "ALREADY_IN_MATCH"
            ? (err.details as { matchId?: string } | undefined)?.matchId
            : undefined;
        if (existing) {
          router.push(`/student/play/${existing}`);
          return;
        }
        notifyError(err, "Couldn't start searching");
      },
    });
  }

  const searching = current?.state === "searching";

  return (
    <Card className="mb-6 border-brand/30 bg-brand/5">
      <CardContent className="flex flex-wrap items-center gap-4">
        {searching ? (
          <Loader2 className="size-6 animate-spin text-brand" />
        ) : (
          <Swords className="size-6 text-brand" />
        )}
        <div className="flex-1" aria-live="polite">
          {searching ? (
            <>
              <p className="font-semibold">
                Looking for an opponent… <Elapsed since={current.since} />
              </p>
              <p className="text-sm text-muted-foreground">
                {current.waiting > 1
                  ? `${current.waiting} players searching. Pairing you with someone you haven't played yet.`
                  : "You're first in line. You'll be paired as soon as someone else searches."}
              </p>
            </>
          ) : matchId ? (
            <p className="font-semibold">Opponent found! Opening the board…</p>
          ) : (
            <>
              <p className="font-semibold">Ready to play?</p>
              <p className="text-sm text-muted-foreground">
                Find an opponent and play a live {tournament.timeControl} game.
              </p>
            </>
          )}
        </div>

        {status.isPending ? (
          <Button disabled>
            <Loader2 className="animate-spin" /> Checking…
          </Button>
        ) : searching ? (
          <Button
            variant="outline"
            onClick={() => cancel.mutate()}
            disabled={cancel.isPending}
          >
            <X /> Cancel
          </Button>
        ) : (
          !matchId && (
            <Button onClick={onFind} disabled={find.isPending}>
              {find.isPending ? <Loader2 className="animate-spin" /> : <Swords />}
              Find opponent
            </Button>
          )
        )}
      </CardContent>
    </Card>
  );
}

/** "0:12" since the given ISO time, ticking every second. */
function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  return (
    <span className="font-mono tabular-nums text-muted-foreground">
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
    </span>
  );
}
