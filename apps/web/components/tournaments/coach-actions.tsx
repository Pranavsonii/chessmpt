"use client";

import { Flag, Loader2, Pencil, Play, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { isApiError } from "@/lib/api/client";
import type { Tournament, TournamentStatus } from "@/lib/api/types";
import {
  useChangeTournamentStatus,
  useDeleteTournament,
} from "@/lib/tournaments";
import { TournamentFormDialog } from "./tournament-form-dialog";

const errorMessage = (e: unknown) => (isApiError(e) ? e.message : "Something went wrong.");

/** The single next step in the lifecycle, with what it means for students. */
const NEXT_STEP: Partial<
  Record<
    TournamentStatus,
    { to: TournamentStatus; label: string; icon: typeof Play; title: string; description: string }
  >
> = {
  draft: {
    to: "open",
    label: "Open registration",
    icon: UserPlus,
    title: "Open registration?",
    description:
      "Students will see this tournament and can join it. The tournament can't go back to draft.",
  },
  open: {
    to: "ongoing",
    label: "Start tournament",
    icon: Play,
    title: "Start the tournament?",
    description:
      "Registration closes and matchmaking begins: students can click “Find opponent” and play. The time control is locked from now on.",
  },
  ongoing: {
    to: "completed",
    label: "Complete tournament",
    icon: Flag,
    title: "Complete the tournament?",
    description:
      "No new games can start. Final standings are fixed and the winner is declared. This can't be undone.",
  },
};

export function CoachActions({ tournament }: { tournament: Tournament }) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "status" | "delete">(null);
  const router = useRouter();
  const changeStatus = useChangeTournamentStatus(tournament.id);
  const remove = useDeleteTournament(tournament.id);

  const next = NEXT_STEP[tournament.status];
  const pending = changeStatus.isPending || remove.isPending;

  function runStatusChange() {
    if (!next) return;
    changeStatus.mutate(next.to, {
      onSuccess: (t) => {
        toast.success(`${t.name} is now ${t.status}`);
        setConfirm(null);
      },
      onError: (e) => {
        toast.error(errorMessage(e));
        setConfirm(null);
      },
    });
  }

  function runDelete() {
    remove.mutate(undefined, {
      onSuccess: () => {
        toast.success("Tournament deleted");
        router.replace("/coach");
      },
      onError: (e) => {
        toast.error(errorMessage(e));
        setConfirm(null);
      },
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tournament.status !== "completed" && (
        <Button variant="outline" onClick={() => setEditOpen(true)} disabled={pending}>
          <Pencil /> Edit
        </Button>
      )}
      {tournament.status === "draft" && (
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirm("delete")}
          disabled={pending}
        >
          <Trash2 /> Delete
        </Button>
      )}
      {next && (
        <Button onClick={() => setConfirm("status")} disabled={pending}>
          <next.icon /> {next.label}
        </Button>
      )}

      <TournamentFormDialog open={editOpen} onOpenChange={setEditOpen} tournament={tournament} />

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && !pending && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "delete" ? "Delete this draft?" : next?.title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete"
                ? `"${tournament.name}" will be removed permanently.`
                : next?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            {/* A plain Button (not AlertDialogAction) so the dialog stays open while the request runs */}
            <Button
              variant={confirm === "delete" ? "destructive" : "default"}
              onClick={confirm === "delete" ? runDelete : runStatusChange}
              disabled={pending}
            >
              {pending && <Loader2 className="animate-spin" />}
              {confirm === "delete" ? "Delete" : next?.label}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
