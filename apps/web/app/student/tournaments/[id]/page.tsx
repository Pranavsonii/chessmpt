"use client";

import { Hourglass, Lock, Trophy } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ActiveMatchBanner } from "@/components/active-match-banner";
import { FindOpponentCard } from "@/components/matchmaking/find-opponent-card";
import { JoinButton } from "@/components/tournaments/join-button";
import { LeaderboardCard, ResultsCard, WinnerBanner } from "@/components/tournaments/results";
import { StatusBadge } from "@/components/tournaments/status-badge";
import {
  BackLink,
  ParticipantsCard,
  TournamentFacts,
  TournamentLoader,
} from "@/components/tournaments/tournament-details";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Tournament } from "@/lib/api/types";
import { useMe } from "@/lib/auth";
import { useWatchTournament } from "@/lib/tournaments";

export default function StudentTournamentPage() {
  const { id } = useParams<{ id: string }>();
  const { data: me } = useMe();
  useWatchTournament(id);

  return (
    <TournamentLoader id={id} back={<BackLink href="/student" label="Tournaments" />}>
      {(t) => (
        <>
          <ActiveMatchBanner />
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <StatusBadge status={t.status} />
              <h1 className="text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">
                {t.name}
              </h1>
            </div>
            <JoinButton tournament={t} />
          </div>

          <WinnerBanner tournament={t} />
          <PlayCard tournament={t} />
          <TournamentFacts tournament={t} />

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_2fr]">
            <ParticipantsCard tournament={t} meId={me?.id} />
            <LeaderboardCard tournament={t} meId={me?.id} />
          </div>
          <ResultsCard tournament={t} meId={me?.id} />
        </>
      )}
    </TournamentLoader>
  );
}

/** What the student can do next in this tournament, depending on status and membership. */
function PlayCard({ tournament: t }: { tournament: Tournament }) {
  if (t.isJoined && t.status === "ongoing") return <FindOpponentCard tournament={t} />;

  const state = !t.isJoined
    ? t.status === "open"
      ? null // the Join button in the header is the call to action
      : {
          icon: Lock,
          title: "Registration is closed",
          text:
            t.status === "completed"
              ? "This tournament has finished."
              : "This tournament has already started. Watch for the next one!",
        }
    : t.status === "open"
      ? {
          icon: Hourglass,
          title: "You're registered",
          text: "Matchmaking opens when your coach starts the tournament.",
        }
      : { icon: Trophy, title: "Tournament finished", text: "See the final standings below." };

  if (!state) return null;
  const Icon = state.icon;

  return (
    <Card className="mb-6 border-brand/30 bg-brand/5">
      <CardContent className="flex flex-wrap items-center gap-4">
        <Icon className="size-6 text-brand" />
        <div className="flex-1">
          <p className="font-semibold">{state.title}</p>
          <p className="text-sm text-muted-foreground">{state.text}</p>
        </div>
        {t.isJoined && t.status === "completed" && (
          <Button variant="outline" asChild>
            <Link href="/student/history">My games</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
