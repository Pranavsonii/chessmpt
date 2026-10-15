"use client";

import { CalendarDays, ChevronRight, Swords } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { StatusBadge } from "@/components/tournaments/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatTime } from "@/lib/format";
import { useSchedule } from "@/lib/player";

export default function SchedulePage() {
  const schedule = useSchedule();

  return (
    <>
      <PageHeader title="My schedule" description="Your current game and upcoming tournaments." />

      {schedule.isPending ? (
        <LoadingState rows={3} label="Loading schedule" />
      ) : schedule.isError ? (
        <ErrorState
          title="Couldn't load your schedule"
          error={schedule.error}
          onRetry={() => schedule.refetch()}
        />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Swords className="size-5 text-brand" /> Now playing
              </CardTitle>
            </CardHeader>
            <CardContent>
              {schedule.data.activeMatch ? (
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex-1">
                    <p className="font-semibold">vs {schedule.data.activeMatch.opponent.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {schedule.data.activeMatch.tournament.name} · you play{" "}
                      {schedule.data.activeMatch.color}
                    </p>
                  </div>
                  <Button asChild>
                    <Link href={`/student/play/${schedule.data.activeMatch.matchId}`}>
                      Resume game
                    </Link>
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No game in progress. Open an ongoing tournament and click “Find opponent”.
                </p>
              )}
            </CardContent>
          </Card>

          <section>
            <h2 className="mb-3 text-lg font-bold text-primary">Tournaments</h2>
            {schedule.data.tournaments.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Nothing scheduled"
                description="Tournaments you join will show up here until they finish."
                action={
                  <Button variant="outline" asChild>
                    <Link href="/student">Browse tournaments</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y rounded-xl border bg-card">
                {schedule.data.tournaments.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/student/tournaments/${t.id}`}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-accent/50"
                    >
                      <div className="w-36 shrink-0 text-sm">
                        <p className="font-semibold">{formatDate(t.startsAt)}</p>
                        <p className="text-muted-foreground">
                          {formatTime(t.startsAt)}
                        </p>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{t.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {t.timeControl} · {t.participantCount} players
                        </p>
                      </div>
                      <StatusBadge status={t.status} />
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
