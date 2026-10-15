"use client";

import { Flag, WifiOff } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Clock } from "@/components/game/clock";
import { GameBoard } from "@/components/game/game-board";
import { PgnPanel } from "@/components/game/pgn-panel";
import { describeResult, ResultDialog } from "@/components/game/result-dialog";
import { EmptyState, LoadingState } from "@/components/states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMe } from "@/lib/auth";
import { type MatchSnapshot, type Side, useLiveMatch } from "@/lib/live-match";
import { cn } from "@/lib/utils";

export default function PlayPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const me = useMe();
  const live = useLiveMatch(matchId, me.data?.id);
  const [resultClosed, setResultClosed] = useState(false);
  const { game } = live;

  if (live.error && !game) {
    const notMine = live.error.code === "NOT_A_PLAYER";
    return (
      <EmptyState
        title={notMine ? "This isn't your game" : "Game not found"}
        description={notMine ? "Only the two players can open a live game." : live.error.message}
        action={
          <Button variant="outline" asChild>
            <Link href="/student/schedule">My schedule</Link>
          </Button>
        }
      />
    );
  }
  if (!game || !live.position) return <LoadingState rows={2} label="Loading game" />;

  // You see the board from your side; anyone else (not reachable today) from White's.
  const orientation: Side = live.myColor ?? "white";
  const top: Side = orientation === "white" ? "black" : "white";
  const active = game.status === "active";
  const last = game.moves.at(-1);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="mx-auto w-full max-w-[640px] space-y-3">
        {active && live.socketStatus !== "connected" && (
          <Alert variant="destructive">
            <WifiOff />
            <AlertDescription>Reconnecting… your clock is still running.</AlertDescription>
          </Alert>
        )}
        <PlayerBar game={game} side={top} clockAt={live.clockAt} />
        <GameBoard
          position={live.position}
          orientation={orientation}
          canMove={live.canMove}
          lastMove={last && { from: last.from, to: last.to }}
          onMove={live.makeMove}
        />
        <PlayerBar game={game} side={orientation} clockAt={live.clockAt} isMe={!!live.myColor} />
      </div>

      <aside className="space-y-4">
        <Card>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{game.tournament.name}</p>
            <StatusLine game={game} me={live.myColor} clockAt={live.clockAt} />
            {active && live.myColor && <ResignButton onResign={live.resign} />}
            {!active && (
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/student/tournaments/${game.tournament.id}`}>Back to tournament</Link>
              </Button>
            )}
          </CardContent>
        </Card>
        <PgnPanel moves={game.moves} pgn={game.pgn} />
      </aside>

      <ResultDialog
        game={game}
        me={live.myColor}
        open={live.endedLive && !resultClosed}
        onOpenChange={(open) => setResultClosed(!open)}
      />
    </div>
  );
}

function PlayerBar({
  game,
  side,
  clockAt,
  isMe = false,
}: {
  game: MatchSnapshot;
  side: Side;
  clockAt: number;
  isMe?: boolean;
}) {
  const player = side === "white" ? game.white : game.black;
  const ms = side === "white" ? game.clock.whiteMs : game.clock.blackMs;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "size-4 shrink-0 rounded-full border-2 border-foreground/60",
            side === "white" ? "bg-white" : "bg-neutral-800",
          )}
        />
        <span className="truncate font-semibold">{player.name}</span>
        {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
      </div>
      <Clock ms={ms} running={game.clock.running === side} since={clockAt} />
    </div>
  );
}

function StatusLine({ game, me, clockAt }: { game: MatchSnapshot; me: Side | null; clockAt: number }) {
  if (game.status !== "active") {
    const { title, detail } = describeResult(game, me);
    return (
      <div>
        <p className="text-lg font-bold">{title}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
    );
  }
  const yourTurn = me === game.turn;
  return (
    <div>
      <p className="text-lg font-bold">
        {yourTurn ? "Your move" : `${game.turn === "white" ? game.white.name : game.black.name} to move`}
      </p>
      {game.firstMoveDeadline && (
        <FirstMoveCountdown
          // Server epoch -> local epoch, so a skewed local clock doesn't matter.
          deadline={game.firstMoveDeadline - game.clock.serverNow + clockAt}
        />
      )}
    </div>
  );
}

/** Before the first move no clock runs; White has a short window or the game is aborted. */
function FirstMoveCountdown({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <p className="text-sm text-muted-foreground">
      White must move within {seconds}s or the game is aborted.
    </p>
  );
}

function ResignButton({ onResign }: { onResign: () => Promise<void> }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Flag /> Resign
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Resign this game?</AlertDialogTitle>
          <AlertDialogDescription>Your opponent will be awarded the win. This can&apos;t be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep playing</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void onResign()}>
            Resign
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
