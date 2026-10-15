"use client";

import { Crown, Trophy } from "lucide-react";
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
import type { Leaderboard } from "@/lib/api/types";
import { formatPoints, formatQuarters, useLeaderboard } from "@/lib/standings";
import { cn } from "@/lib/utils";

/** Rank, name, P W D L, points and Sonneborn-Berger. Your own row is highlighted. */
export function LeaderboardCard({ tournamentId, meId }: { tournamentId: string; meId?: string }) {
  const board = useLeaderboard(tournamentId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
        <CardDescription>
          {board.data?.final ? "Final standings." : "Updates live as games finish."} Ties: Sonneborn-Berger,
          then wins, then head-to-head.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {board.isPending ? (
          <LoadingState rows={3} label="Loading leaderboard" />
        ) : board.isError ? (
          <ErrorState error={board.error} onRetry={() => board.refetch()} />
        ) : !board.data.rows.some((r) => r.played > 0) ? (
          <EmptyState
            icon={Trophy}
            title="No games played yet"
            description="Standings appear here as soon as the first game finishes."
          />
        ) : (
          <StandingsTable board={board.data} meId={meId} />
        )}
      </CardContent>
    </Card>
  );
}

function StandingsTable({ board, meId }: { board: Leaderboard; meId?: string }) {
  const winnerIds = new Set(board.winners.map((w) => w.id));
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-right">#</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-right" title="Played">P</TableHead>
            <TableHead className="text-right" title="Wins">W</TableHead>
            <TableHead className="text-right" title="Draws">D</TableHead>
            <TableHead className="text-right" title="Losses">L</TableHead>
            <TableHead className="text-right">Pts</TableHead>
            <TableHead className="text-right" title="Sonneborn-Berger tiebreak">SB</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {board.rows.map((r) => (
            <TableRow key={r.userId} className={cn(r.userId === meId && "bg-brand/10 hover:bg-brand/15")}>
              <TableCell className="text-right font-semibold tabular-nums">{r.rank}</TableCell>
              <TableCell className="font-medium">
                <span className="inline-flex items-center gap-1.5">
                  {winnerIds.has(r.userId) && <Crown className="size-4 text-amber-500" aria-label="Winner" />}
                  {r.name}
                  {r.userId === meId && <Badge variant="secondary">You</Badge>}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.played}</TableCell>
              <TableCell className="text-right tabular-nums">{r.wins}</TableCell>
              <TableCell className="text-right tabular-nums">{r.draws}</TableCell>
              <TableCell className="text-right tabular-nums">{r.losses}</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{formatPoints(r.halfPoints)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {formatQuarters(r.sbQuarters)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** 🏆 once the tournament is completed: the winner, or co-winners on a shared first place. */
export function WinnerBanner({ tournamentId }: { tournamentId: string }) {
  const board = useLeaderboard(tournamentId);
  if (!board.data?.final) return null;
  const { winners } = board.data;

  return (
    <Card className="mb-6 border-amber-400/50 bg-amber-50 dark:bg-amber-950/30">
      <CardContent className="flex items-center gap-4">
        <Trophy className="size-8 shrink-0 text-amber-500" aria-hidden />
        <div>
          {winners.length === 0 ? (
            <p className="font-semibold">Tournament completed. No games were played, so there is no winner.</p>
          ) : winners.length === 1 ? (
            <>
              <p className="text-sm text-muted-foreground">Tournament winner</p>
              <p className="text-xl font-extrabold">{winners[0].name}</p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Shared first place (still tied after every tiebreak)</p>
              <p className="text-xl font-extrabold">{winners.map((w) => w.name).join(" & ")}</p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
