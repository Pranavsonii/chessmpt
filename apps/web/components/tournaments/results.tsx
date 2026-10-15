"use client";

import { Crown, ListOrdered, Swords, Trophy } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Tournament, TournamentMatch } from "@/lib/api/types";
import { formatDateTime, formatPoints, formatSb } from "@/lib/format";
import { TERMINATION_LABEL } from "@/lib/player";
import { useLeaderboard, useTournamentMatches } from "@/lib/tournaments";
import { cn } from "@/lib/utils";

/** Leaderboard, results and stats for the coach and student tournament pages. */

/** Standings and results only exist once play has started. */
const hasPlay = (t: Tournament) => t.status === "ongoing" || t.status === "completed";

// ------------------------------------------------------------------ leaderboard

export function LeaderboardCard({ tournament: t, meId }: { tournament: Tournament; meId?: string }) {
  const board = useLeaderboard(t.id, hasPlay(t));

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
        <CardDescription>
          {t.status === "completed" ? "Final standings" : "Updates live after every game"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasPlay(t) ? (
          <EmptyState
            icon={ListOrdered}
            title="Standings appear once the tournament starts"
            description="Every finished game updates the table."
          />
        ) : board.isPending ? (
          <LoadingState rows={4} label="Loading leaderboard" />
        ) : board.isError ? (
          <ErrorState error={board.error} onRetry={() => board.refetch()} />
        ) : !board.data.rows.some((r) => r.played > 0) ? (
          <EmptyState
            icon={ListOrdered}
            title="No games played yet"
            description="The table fills in as games finish."
          />
        ) : (
          <>
            <div className="-mx-6 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 pl-6 text-right">#</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-right" title="Games played">P</TableHead>
                    <TableHead className="text-right" title="Wins">W</TableHead>
                    <TableHead className="text-right" title="Draws">D</TableHead>
                    <TableHead className="text-right" title="Losses">L</TableHead>
                    <TableHead className="text-right">Pts</TableHead>
                    <TableHead className="pr-6 text-right" title="Sonneborn-Berger tiebreak">
                      SB
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {board.data.rows.map((r) => {
                    const champion = board.data.final && r.rank === 1 && r.played > 0;
                    return (
                      <TableRow
                        key={r.userId}
                        className={cn(r.userId === meId && "bg-brand/10 hover:bg-brand/15")}
                      >
                        <TableCell className="pl-6 text-right font-semibold tabular-nums">
                          {r.rank}
                        </TableCell>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            {champion && <Crown className="size-4 text-brand" aria-label="Winner" />}
                            {r.name}
                            {r.userId === meId && <Badge variant="secondary">You</Badge>}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.played}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.wins}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.draws}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.losses}</TableCell>
                        <TableCell className="text-right font-bold tabular-nums">
                          {formatPoints(r.halfPoints)}
                        </TableCell>
                        <TableCell className="pr-6 text-right tabular-nums text-muted-foreground">
                          {formatSb(r.sbQuarters)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Win 1 · draw ½ · loss 0. Ties: points → Sonneborn-Berger (SB) → wins → head-to-head.
              Players still level share a rank.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ winner

export function WinnerBanner({ tournament: t }: { tournament: Tournament }) {
  const board = useLeaderboard(t.id, t.status === "completed");
  if (t.status !== "completed" || !board.data) return null;

  const { winners } = board.data;
  const names = winners.map((w) => w.name);
  const title =
    winners.length === 0
      ? "No games were played"
      : winners.length === 1
        ? `${names[0]} wins the tournament`
        : `Shared first place: ${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

  return (
    <Card className="mb-6 border-brand/40 bg-brand/10">
      <CardContent className="flex items-center gap-4">
        <Trophy className="size-8 shrink-0 text-brand" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Tournament complete</p>
          <p className="text-lg font-extrabold text-primary">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------ results

const RESULT_TEXT = { "1-0": "1 – 0", "0-1": "0 – 1", "1/2-1/2": "½ – ½" } as const;

/** Full moves, rounded up: 3 plies = White's 2nd move played. */
const fullMoves = (plies: number) => Math.ceil(plies / 2);

export function ResultsCard({ tournament: t, meId }: { tournament: Tournament; meId?: string }) {
  const games = useTournamentMatches(t.id, hasPlay(t));
  if (!hasPlay(t)) return null;

  return (
    <Card className="mt-6 min-w-0">
      <CardHeader>
        <CardTitle>Games</CardTitle>
        <CardDescription>Every game in this tournament, newest first</CardDescription>
      </CardHeader>
      <CardContent>
        {games.isPending ? (
          <LoadingState rows={3} label="Loading games" />
        ) : games.isError ? (
          <ErrorState error={games.error} onRetry={() => games.refetch()} />
        ) : games.data.length === 0 ? (
          <EmptyState icon={Swords} title="No games yet" description="Games appear here as soon as players are paired." />
        ) : (
          <div className="-mx-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">White</TableHead>
                  <TableHead className="text-center">Result</TableHead>
                  <TableHead>Black</TableHead>
                  <TableHead>How it ended</TableHead>
                  <TableHead className="text-right">Moves</TableHead>
                  <TableHead className="pr-6">Finished</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {games.data.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="pl-6">
                      <PlayerName player={g.white} meId={meId} won={g.result === "1-0"} />
                    </TableCell>
                    <TableCell className="text-center">
                      <ResultCell game={g} />
                    </TableCell>
                    <TableCell>
                      <PlayerName player={g.black} meId={meId} won={g.result === "0-1"} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {g.termination
                        ? TERMINATION_LABEL[g.termination]
                        : g.status === "aborted"
                          ? "First move not played"
                          : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fullMoves(g.plies)}</TableCell>
                    <TableCell className="pr-6 text-sm text-muted-foreground">
                      {g.endedAt ? formatDateTime(g.endedAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlayerName({
  player,
  meId,
  won,
}: {
  player: { id: string; name: string };
  meId?: string;
  won: boolean;
}) {
  return (
    <span className={cn(won && "font-semibold", player.id === meId && "text-brand")}>
      {player.name}
      {player.id === meId && " (you)"}
    </span>
  );
}

function ResultCell({ game: g }: { game: TournamentMatch }) {
  if (g.status === "active") {
    return (
      <Badge className="bg-emerald-100 text-emerald-800">
        <span className="size-1.5 animate-pulse rounded-full bg-emerald-600" /> Live
      </Badge>
    );
  }
  if (g.status === "aborted" || !g.result) return <Badge variant="outline">Aborted</Badge>;
  return <span className="font-mono font-semibold whitespace-nowrap">{RESULT_TEXT[g.result]}</span>;
}

// ------------------------------------------------------------------ coach stats

export function TournamentStats({ tournament: t }: { tournament: Tournament }) {
  const games = useTournamentMatches(t.id, hasPlay(t));
  if (!hasPlay(t) || !games.data) return null;

  const finished = games.data.filter((g) => g.status === "completed");
  const live = games.data.filter((g) => g.status === "active").length;
  const draws = finished.filter((g) => g.result === "1/2-1/2").length;
  const avgMoves = finished.length
    ? Math.round(finished.reduce((sum, g) => sum + fullMoves(g.plies), 0) / finished.length)
    : null;

  const tiles = [
    { label: "Games played", value: String(finished.length) },
    { label: "Live now", value: String(live) },
    { label: "Draw rate", value: finished.length ? `${Math.round((draws / finished.length) * 100)}%` : "—" },
    { label: "Avg. length", value: avgMoves === null ? "—" : `${avgMoves} moves` },
  ];

  return (
    <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.label} className="gap-1 py-4">
          <CardContent className="space-y-1 px-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{tile.label}</p>
            <p className="text-2xl font-extrabold tabular-nums text-primary">{tile.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
