"use client";

import { Download, Handshake, Radio, Swords } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TournamentMatch } from "@/lib/api/types";
import { formatTime } from "@/lib/format";
import { TERMINATION_LABEL } from "@/lib/player";
import { useTournamentMatches } from "@/lib/standings";

/** Summary tiles + every game's result, for the coach's tournament page. */
export function CoachStats({ tournamentId }: { tournamentId: string }) {
  const games = useTournamentMatches(tournamentId);

  if (games.isPending) return <LoadingState rows={2} label="Loading results" />;
  if (games.isError) return <ErrorState error={games.error} onRetry={() => games.refetch()} />;

  const all = games.data;
  const finished = all.filter((m) => m.status === "completed");
  const live = all.filter((m) => m.status === "active").length;
  const draws = finished.filter((m) => m.result === "1/2-1/2").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Tile icon={Swords} label="Games played" value={String(finished.length)} />
        <Tile icon={Radio} label="Live now" value={String(live)} />
        <Tile
          icon={Handshake}
          label="Draws"
          value={finished.length ? `${Math.round((draws / finished.length) * 100)}%` : "—"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent>
          {all.length === 0 ? (
            <EmptyState title="No games yet" description="Games appear here as soon as players are paired." />
          ) : (
            <ResultsTable games={all} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="space-y-1 px-4">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className="size-3.5" /> {label}
        </p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

/** 754000 -> "12:34" */
const formatDuration = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function downloadPgn(game: TournamentMatch) {
  if (!game.pgn) return;
  const url = URL.createObjectURL(new Blob([game.pgn], { type: "application/x-chess-pgn" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${game.white.name} vs ${game.black.name}.pgn`.replace(/[^\w .-]/g, "");
  a.click();
  URL.revokeObjectURL(url);
}

function ResultsTable({ games }: { games: TournamentMatch[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>White</TableHead>
            <TableHead className="text-center">Result</TableHead>
            <TableHead>Black</TableHead>
            <TableHead>How</TableHead>
            <TableHead className="text-right">Moves</TableHead>
            <TableHead className="text-right">Duration</TableHead>
            <TableHead className="text-right">Started</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {games.map((g) => (
            <TableRow key={g.id}>
              <TableCell className="font-medium">{g.white.name}</TableCell>
              <TableCell className="text-center font-mono">
                {g.status === "active" ? (
                  <Badge className="bg-emerald-600">Live</Badge>
                ) : g.status === "aborted" ? (
                  <Badge variant="outline">Aborted</Badge>
                ) : (
                  g.result?.replace("1/2", "½")
                )}
              </TableCell>
              <TableCell className="font-medium">{g.black.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {g.termination ? TERMINATION_LABEL[g.termination] : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">{Math.ceil(g.plies / 2)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {g.durationMs !== null ? formatDuration(g.durationMs) : "—"}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">{formatTime(g.startedAt)}</TableCell>
              <TableCell className="text-right">
                {g.pgn && g.status === "completed" && (
                  <Button variant="ghost" size="sm" onClick={() => downloadPgn(g)} title="Download PGN">
                    <Download /> PGN
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
