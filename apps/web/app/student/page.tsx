"use client";

import { Search, Trophy } from "lucide-react";
import { useState } from "react";
import { ActiveMatchBanner } from "@/components/active-match-banner";
import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMe } from "@/lib/auth";
import { useTournaments } from "@/lib/tournaments";

type View = "browse" | "mine";

export default function StudentTournamentsPage() {
  const { data: me } = useMe();
  const [view, setView] = useState<View>("browse");

  return (
    <>
      <PageHeader
        title={`Hi, ${me?.name.split(" ")[0] ?? "there"} 👋`}
        description="Join a tournament, find an opponent and play live."
      />
      <ActiveMatchBanner />

      <Tabs value={view} onValueChange={(v) => setView(v as View)} className="mb-6">
        <TabsList>
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="mine">My tournaments</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "browse" ? (
        <TournamentGrid
          statuses={["open", "ongoing"]}
          empty={
            <EmptyState
              icon={Search}
              title="No tournaments to join right now"
              description="Your coach hasn't opened any tournaments yet. Check back soon!"
            />
          }
        />
      ) : (
        <TournamentGrid
          joined
          empty={
            <EmptyState
              icon={Trophy}
              title="You haven't joined any tournaments yet"
              action={
                <Button variant="outline" onClick={() => setView("browse")}>
                  Browse tournaments
                </Button>
              }
            />
          }
        />
      )}
    </>
  );
}

function TournamentGrid({
  statuses,
  joined,
  empty,
}: {
  statuses?: ("open" | "ongoing" | "completed")[];
  joined?: boolean;
  empty: React.ReactNode;
}) {
  const tournaments = useTournaments(statuses, { joined });

  if (tournaments.isPending) return <LoadingState rows={3} label="Loading tournaments" />;
  if (tournaments.isError) {
    return (
      <ErrorState
        title="Couldn't load tournaments"
        error={tournaments.error}
        onRetry={() => tournaments.refetch()}
      />
    );
  }
  if (tournaments.data.length === 0) return <>{empty}</>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tournaments.data.map((t) => (
        <TournamentCard key={t.id} tournament={t} />
      ))}
    </div>
  );
}
