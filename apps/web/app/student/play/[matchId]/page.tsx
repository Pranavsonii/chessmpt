"use client";

import { Swords } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSchedule } from "@/lib/player";

/**
 * Where matchmaking sends both players.
 * PLACEHOLDER: Phase 9 replaces this with the live board, clocks and PGN panel.
 */
export default function PlayPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const schedule = useSchedule();

  if (schedule.isPending) return <LoadingState rows={2} label="Loading game" />;
  if (schedule.isError) {
    return <ErrorState error={schedule.error} onRetry={() => schedule.refetch()} />;
  }

  const m = schedule.data.activeMatch;
  if (!m || m.matchId !== matchId) {
    return (
      <EmptyState
        icon={Swords}
        title="This game isn't in progress"
        description="It may have finished, or it isn't one of your games."
        action={
          <Button variant="outline" asChild>
            <Link href="/student/history">Match history</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <PageHeader title={`You vs ${m.opponent.name}`} description={m.tournament.name} />
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4">
          <span
            aria-hidden
            className={`size-10 rounded-full border-2 ${m.color === "white" ? "bg-white" : "bg-neutral-800"}`}
          />
          <div>
            <p className="font-semibold capitalize">You play {m.color}</p>
            <p className="text-sm text-muted-foreground">
              {m.color === "white" ? "You move first." : `${m.opponent.name} moves first.`} The live
              board arrives with the next phase.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
