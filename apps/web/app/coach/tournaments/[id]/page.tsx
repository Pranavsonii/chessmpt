"use client";

import { ArrowLeft, CalendarClock, Clock, Crown, SearchX, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { CoachActions } from "@/components/tournaments/coach-actions";
import { StatusBadge } from "@/components/tournaments/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/client";
import type { Tournament } from "@/lib/api/types";
import { formatDate, formatDateTime } from "@/lib/format";
import { useParticipants, useTournament } from "@/lib/tournaments";

export default function CoachTournamentPage() {
  const { id } = useParams<{ id: string }>();
  const tournament = useTournament(id);

  const back = (
    <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
      <Link href="/coach">
        <ArrowLeft /> All tournaments
      </Link>
    </Button>
  );

  if (tournament.isPending) {
    return (
      <>
        {back}
        <Skeleton className="mb-6 h-9 w-72" />
        <LoadingState rows={2} label="Loading tournament" />
      </>
    );
  }

  if (tournament.isError) {
    const notFound =
      isApiError(tournament.error) && [400, 404].includes(tournament.error.status);
    return (
      <>
        {back}
        {notFound ? (
          <EmptyState
            icon={SearchX}
            title="Tournament not found"
            description="It may have been deleted."
          />
        ) : (
          <ErrorState error={tournament.error} onRetry={() => tournament.refetch()} />
        )}
      </>
    );
  }

  const t = tournament.data;
  return (
    <>
      {back}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <StatusBadge status={t.status} />
          <h1 className="text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">
            {t.name}
          </h1>
        </div>
        <CoachActions tournament={t} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Fact icon={Clock} label="Time control" value={t.timeControl} hint={describeTc(t)} />
        <Fact icon={CalendarClock} label="Starts" value={formatDateTime(t.startsAt)} />
        <Fact icon={Users} label="Players" value={String(t.participantCount)} />
        <Fact
          icon={Crown}
          label="Winner"
          value={t.winner?.name ?? "—"}
          hint={t.status === "completed" ? undefined : "Declared on completion"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <ParticipantsCard tournament={t} />
        <Card>
          <CardHeader>
            <CardTitle>Leaderboard & results</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="No games played yet"
              description="Standings and per-match results appear here once students start playing."
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function describeTc(t: Tournament) {
  const min = t.initialSeconds / 60;
  return `${min} min each${t.incrementSeconds ? `, +${t.incrementSeconds}s per move` : ", no increment"}`;
}

function Fact({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="space-y-1 px-4">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className="size-3.5" /> {label}
        </p>
        <p className="text-lg font-bold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function ParticipantsCard({ tournament }: { tournament: Tournament }) {
  const participants = useParticipants(tournament.id);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Participants</CardTitle>
      </CardHeader>
      <CardContent>
        {participants.isPending ? (
          <LoadingState rows={3} label="Loading participants" />
        ) : participants.isError ? (
          <ErrorState error={participants.error} onRetry={() => participants.refetch()} />
        ) : participants.data.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No one has joined yet"
            description={
              tournament.status === "draft"
                ? "Open registration so students can join."
                : "Students join from their tournament list."
            }
          />
        ) : (
          <ol className="divide-y">
            {participants.data.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <span className="w-5 text-right text-sm tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="flex-1 font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  joined {formatDate(p.joinedAt)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
