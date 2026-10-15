"use client";

import { ChevronRight, Plus, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { StatusBadge } from "@/components/tournaments/status-badge";
import { TournamentFormDialog } from "@/components/tournaments/tournament-form-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TournamentStatus } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { STATUS_LABEL, useTournaments } from "@/lib/tournaments";

type Filter = "all" | TournamentStatus;
const FILTERS: Filter[] = ["all", "draft", "open", "ongoing", "completed"];

export default function CoachTournamentsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const router = useRouter();
  // One request for everything; tabs filter on the client, so switching is instant.
  const tournaments = useTournaments();

  const all = tournaments.data ?? [];
  const visible = filter === "all" ? all : all.filter((t) => t.status === filter);
  const countOf = (f: Filter) => (f === "all" ? all.length : all.filter((t) => t.status === f).length);

  return (
    <>
      <PageHeader
        title="Tournaments"
        description="Create tournaments, open registration and follow results."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> New tournament
          </Button>
        }
      />
      <TournamentFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      {tournaments.isPending ? (
        <LoadingState rows={4} label="Loading tournaments" />
      ) : tournaments.isError ? (
        <ErrorState
          title="Couldn't load tournaments"
          error={tournaments.error}
          onRetry={() => tournaments.refetch()}
        />
      ) : all.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No tournaments yet"
          description="Create your first tournament. It starts as a draft only you can see."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> New tournament
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList className="flex-wrap">
              {FILTERS.map((f) => (
                <TabsTrigger key={f} value={f}>
                  {f === "all" ? "All" : STATUS_LABEL[f]}
                  <span className="ml-1.5 text-xs text-muted-foreground">{countOf(f)}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {visible.length === 0 ? (
            <EmptyState
              title={`No ${STATUS_LABEL[filter as TournamentStatus].toLowerCase()} tournaments`}
            />
          ) : (
            <Card className="overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Name</TableHead>
                    <TableHead>Time control</TableHead>
                    <TableHead>Starts</TableHead>
                    <TableHead className="text-right">Players</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((t) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/coach/tournaments/${t.id}`)}
                    >
                      <TableCell className="pl-4 font-semibold">
                        {/* A real link too, for keyboard users and "open in new tab" */}
                        <Link
                          href={`/coach/tournaments/${t.id}`}
                          className="hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t.name}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{t.timeControl}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(t.startsAt)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{t.participantCount}</TableCell>
                      <TableCell>
                        <StatusBadge status={t.status} />
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
