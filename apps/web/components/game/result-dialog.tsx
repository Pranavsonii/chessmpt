"use client";

import { Flag, Handshake, Trophy } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MatchSnapshot, Side } from "@/lib/live-match";
import { TERMINATION_LABEL } from "@/lib/player";

/** "You won by checkmate", "Draw by stalemate", "Game aborted"... from your point of view. */
export function describeResult(game: MatchSnapshot, me: Side | null): { title: string; detail: string } {
  if (game.status === "aborted") {
    return { title: "Game aborted", detail: "White didn't make a first move in time. No result was recorded." };
  }
  const how = game.termination ? TERMINATION_LABEL[game.termination].toLowerCase() : "";
  if (game.result === "1/2-1/2") return { title: "Draw", detail: `Draw by ${how}.` };
  const winner: Side = game.result === "1-0" ? "white" : "black";
  const winnerName = winner === "white" ? game.white.name : game.black.name;
  if (!me) return { title: `${winnerName} won`, detail: `By ${how}.` };
  return winner === me
    ? { title: "You won!", detail: `You won by ${how}.` }
    : { title: "You lost", detail: `${winnerName} won by ${how}.` };
}

export function ResultDialog({
  game,
  me,
  open,
  onOpenChange,
}: {
  game: MatchSnapshot;
  me: Side | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { title, detail } = describeResult(game, me);
  const won = game.result !== null && game.result !== "1/2-1/2" && (game.result === "1-0") === (me === "white");
  const Icon = won ? Trophy : game.result === "1/2-1/2" ? Handshake : Flag;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <Icon className={won ? "size-10 text-amber-500" : "size-10 text-muted-foreground"} aria-hidden />
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          <DialogDescription>
            {detail} {game.result && <span className="font-mono">({game.result})</span>}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button variant="outline" asChild>
            <Link href="/student/history">Match history</Link>
          </Button>
          {/* The tournament page has the standings and the "Find opponent" button. */}
          <Button asChild>
            <Link href={`/student/tournaments/${game.tournament.id}`}>Find next opponent</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
