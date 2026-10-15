"use client";

import { ArrowLeft, CalendarClock, Clock, Crown, SearchX, Users } from "lucide-react";
import Link from "next/link";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/client";
import type { Tournament } from "@/lib/api/types";
import { formatDate, formatDateTime } from "@/lib/format";
import { useParticipants, useTournament } from "@/lib/tournaments";

/** Shared by the coach and student tournament pages. */

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
      <Link href={href}>
        <ArrowLeft /> {label}
      </Link>
    </Button>
  );
}

/**
 * Loads a tournament and handles the loading / not found / error states,
 * then renders `children(tournament)`.
 */
export function TournamentLoader({
  id,
  back,
  children,
}: {
  id: string;
  back: React.ReactNode;
  children: (t: Tournament) => React.ReactNode;
}) {
  const tournament = useTournament(id);

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
            description="It may have been deleted, or it isn't open to students yet."
          />
        ) : (
          <ErrorState error={tournament.error} onRetry={() => tournament.refetch()} />
        )}
      </>
    );
  }

  return (
    <>
      {back}
      {children(tournament.data)}
    </>
  );
}

const describeTc = (t: Tournament) =>
  `${t.initialSeconds / 60} min each${t.incrementSeconds ? `, +${t.incrementSeconds}s per move` : ", no increment"}`;

export function TournamentFacts({ tournament: t }: { tournament: Tournament }) {
  return (
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
  );
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

export function ParticipantsCard({
  tournament,
  meId,
}: {
  tournament: Tournament;
  /** Highlights "you" in the list (student view). */
  meId?: string;
}) {
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
                : tournament.status === "open"
                  ? "Be the first to join!"
                  : undefined
            }
          />
        ) : (
          <ol className="divide-y">
            {participants.data.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <span className="w-5 text-right text-sm tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <span className="flex-1 font-medium">
                  {p.name}
                  {p.id === meId && (
                    <Badge variant="secondary" className="ml-2">
                      You
                    </Badge>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">joined {formatDate(p.joinedAt)}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
