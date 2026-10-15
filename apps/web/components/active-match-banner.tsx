"use client";

import { Swords } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSchedule } from "@/lib/player";

/**
 * "You have a game in progress": shown on student pages so a player who navigated
 * away (or refreshed) can always get back to their board.
 */
export function ActiveMatchBanner() {
  const { data } = useSchedule();
  const m = data?.activeMatch;
  if (!m) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-brand/40 bg-brand/10 px-4 py-3">
      <Swords className="size-5 text-brand" />
      <p className="flex-1 text-sm">
        <span className="font-semibold">Game in progress</span> vs {m.opponent.name} in{" "}
        {m.tournament.name} · you play {m.color}
      </p>
      <Button size="sm" asChild>
        <Link href={`/student/play/${m.matchId}`}>Resume game</Link>
      </Button>
    </div>
  );
}
