"use client";

import { useParams } from "next/navigation";
import { CoachActions } from "@/components/tournaments/coach-actions";
import { StatusBadge } from "@/components/tournaments/status-badge";
import {
  BackLink,
  LeaderboardPlaceholder,
  ParticipantsCard,
  TournamentFacts,
  TournamentLoader,
} from "@/components/tournaments/tournament-details";

export default function CoachTournamentPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <TournamentLoader id={id} back={<BackLink href="/coach" label="All tournaments" />}>
      {(t) => (
        <>
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <StatusBadge status={t.status} />
              <h1 className="text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">
                {t.name}
              </h1>
            </div>
            <CoachActions tournament={t} />
          </div>

          <TournamentFacts tournament={t} />

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_2fr]">
            <ParticipantsCard tournament={t} />
            <LeaderboardPlaceholder />
          </div>
        </>
      )}
    </TournamentLoader>
  );
}
