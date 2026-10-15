"use client";

import { Check, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Tournament } from "@/lib/api/types";
import { useJoinTournament } from "@/lib/tournaments";
import { notifyError } from "@/lib/notify";

/** Join button for students; turns into a "Joined" badge once in. */
export function JoinButton({
  tournament,
  size = "default",
}: {
  tournament: Tournament;
  size?: "default" | "sm";
}) {
  const join = useJoinTournament(tournament.id);

  if (tournament.isJoined) {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-800">
        <Check className="size-3" /> Joined
      </Badge>
    );
  }
  if (tournament.status !== "open") return null;

  return (
    <Button
      size={size}
      disabled={join.isPending}
      onClick={() => {
        join.mutate(undefined, {
          onSuccess: (t) => toast.success(`You're in! Welcome to ${t.name}.`),
          onError: (err) =>
            notifyError(err, "Couldn't join"),
        });
      }}
    >
      {join.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
      {join.isPending ? "Joining…" : "Join"}
    </Button>
  );
}
