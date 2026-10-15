"use client";

import { History } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app-shell";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
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
import type { MatchHistoryItem } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { OUTCOME_LABEL, TERMINATION_LABEL, useMatchHistory } from "@/lib/player";
import { cn } from "@/lib/utils";

const OUTCOME_STYLE = {
  win: "bg-emerald-100 text-emerald-800",
  loss: "bg-red-100 text-red-800",
  draw: "bg-muted text-muted-foreground",
} as const;

export default function HistoryPage() {
  const history = useMatchHistory();

  return (
    <>
      <PageHeader title="Match history" description="Every game you've finished, newest first." />

      {history.isPending ? (
        <LoadingState rows={4} label="Loading match history" />
      ) : history.isError ? (
        <ErrorState
          title="Couldn't load your games"
          error={history.error}
          onRetry={() => history.refetch()}
        />
      ) : history.data.length === 0 ? (
        <EmptyState
          icon={History}
          title="No games yet"
          description="Join a tournament and find an opponent to play your first game."
          action={
            <Button variant="outline" asChild>
              <Link href="/student">Browse tournaments</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Summary games={history.data} />
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Result</TableHead>
                  <TableHead>Opponent</TableHead>
                  <TableHead>Colour</TableHead>
                  <TableHead>How it ended</TableHead>
                  <TableHead>Tournament</TableHead>
                  <TableHead>Finished</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.data.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="pl-4">
                      {m.outcome ? (
                        <Badge className={cn("font-semibold", OUTCOME_STYLE[m.outcome])}>
                          {OUTCOME_LABEL[m.outcome]}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Aborted</Badge>
                      )}
                      {m.result && (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {m.result}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{m.opponent.name}</TableCell>
                    <TableCell className="capitalize">
                      <span
                        aria-hidden
                        className={cn(
                          "mr-1.5 inline-block size-3 rounded-full border align-[-1px]",
                          m.color === "white" ? "bg-white" : "bg-neutral-800",
                        )}
                      />
                      {m.color}
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.termination ? TERMINATION_LABEL[m.termination] : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      <Link href={`/student/tournaments/${m.tournament.id}`} className="hover:underline">
                        {m.tournament.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.endedAt ? formatDateTime(m.endedAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </>
  );
}

function Summary({ games }: { games: MatchHistoryItem[] }) {
  const count = (o: "win" | "loss" | "draw") => games.filter((g) => g.outcome === o).length;
  const items = [
    { label: "Wins", value: count("win"), className: "text-emerald-700" },
    { label: "Draws", value: count("draw"), className: "text-muted-foreground" },
    { label: "Losses", value: count("loss"), className: "text-red-700" },
  ];
  return (
    <div className="mb-4 flex flex-wrap gap-6 text-sm">
      {items.map((i) => (
        <p key={i.label}>
          <span className={cn("text-2xl font-extrabold tabular-nums", i.className)}>{i.value}</span>{" "}
          <span className="text-muted-foreground">{i.label}</span>
        </p>
      ))}
    </div>
  );
}
