"use client";

import { CalendarClock, Clock, Users } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { Tournament } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { JoinButton } from "./join-button";
import { StatusBadge } from "./status-badge";

/**
 * Student-facing tournament card. The whole card is clickable via a "stretched link"
 * (the title link's ::after covers the card), so the Join button isn't nested inside
 * a link: a button inside an <a> is invalid HTML and confuses keyboards/screen readers.
 */
export function TournamentCard({ tournament: t }: { tournament: Tournament }) {
  return (
    <Card className="group relative h-full transition-shadow hover:shadow-md">
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold leading-snug">
            <Link
              href={`/student/tournaments/${t.id}`}
              className="after:absolute after:inset-0 after:rounded-xl group-hover:underline"
            >
              {t.name}
            </Link>
          </h3>
          <StatusBadge status={t.status} className="shrink-0" />
        </div>
        <dl className="grid gap-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="size-4" />
            <dt className="sr-only">Time control</dt>
            <dd className="font-mono text-foreground">{t.timeControl}</dd>
          </div>
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4" />
            <dt className="sr-only">Starts</dt>
            <dd>{formatDateTime(t.startsAt)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Users className="size-4" />
            <dt className="sr-only">Players</dt>
            <dd>
              {t.participantCount} {t.participantCount === 1 ? "player" : "players"}
            </dd>
          </div>
        </dl>
        {/* relative z-10 lifts the button above the stretched link */}
        <div className="relative z-10 mt-auto flex justify-end">
          <JoinButton tournament={t} size="sm" />
        </div>
      </CardContent>
    </Card>
  );
}
