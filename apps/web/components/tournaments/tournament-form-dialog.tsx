"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isApiError } from "@/lib/api/client";
import type { Tournament } from "@/lib/api/types";
import { fromIstInputValue, toIstInputValue } from "@/lib/format";
import {
  TIME_CONTROL_PRESETS,
  useCreateTournament,
  useUpdateTournament,
} from "@/lib/tournaments";

const CUSTOM = "custom";
const isPreset = (tc: string) => TIME_CONTROL_PRESETS.some((p) => p.value === tc);

/** Tomorrow at 17:00 IST, as a datetime-local value. */
function defaultStart(): string {
  const d = new Date(Date.now() + 24 * 3600_000);
  return `${toIstInputValue(d.toISOString()).slice(0, 10)}T17:00`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit mode. */
  tournament?: Tournament;
}

export function TournamentFormDialog({ open, onOpenChange, tournament }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Remount the form on every open so it starts from fresh values */}
        {open && <TournamentForm tournament={tournament} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function TournamentForm({ tournament, onDone }: { tournament?: Tournament; onDone: () => void }) {
  const router = useRouter();
  const editing = !!tournament;
  const create = useCreateTournament();
  const update = useUpdateTournament(tournament?.id ?? "");
  const mutation = editing ? update : create;

  const timeControlLocked =
    editing && tournament.status !== "draft" && tournament.status !== "open";

  const [name, setName] = useState(tournament?.name ?? "");
  const initialTc = tournament?.timeControl ?? "5+0";
  const [preset, setPreset] = useState(isPreset(initialTc) ? initialTc : CUSTOM);
  const [customTc, setCustomTc] = useState(isPreset(initialTc) ? "" : initialTc);
  const [startsAt, setStartsAt] = useState(
    tournament ? toIstInputValue(tournament.startsAt) : defaultStart(),
  );

  const timeControl = preset === CUSTOM ? customTc.trim() : preset;
  const fieldErrors = isApiError(mutation.error) ? mutation.error.fieldErrors : {};
  const formError =
    mutation.error && Object.keys(fieldErrors).length === 0
      ? isApiError(mutation.error)
        ? mutation.error.message
        : "Something went wrong."
      : null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = {
      name: name.trim(),
      startsAt: fromIstInputValue(startsAt),
      ...(timeControlLocked ? {} : { timeControl }),
    };

    if (editing) {
      update.mutate(input, {
        onSuccess: () => {
          toast.success("Tournament updated");
          onDone();
        },
      });
    } else {
      create.mutate(
        { ...input, timeControl },
        {
          onSuccess: (t) => {
            toast.success(`"${t.name}" created as a draft`);
            onDone();
            router.push(`/coach/tournaments/${t.id}`);
          },
        },
      );
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit tournament" : "New tournament"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "Changes are visible to students right away."
            : "It starts as a draft. Only you can see it until you open registration."}
        </DialogDescription>
      </DialogHeader>

      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="t-name">Name</Label>
        <Input
          id="t-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Diwali Blitz Cup"
          maxLength={120}
          aria-invalid={!!fieldErrors.name}
          autoFocus
        />
        {fieldErrors.name && <p className="text-sm text-destructive">{fieldErrors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="t-tc">Time control</Label>
        <Select value={preset} onValueChange={setPreset} disabled={timeControlLocked}>
          <SelectTrigger id="t-tc" className="w-full" aria-invalid={!!fieldErrors.timeControl}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_CONTROL_PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM}>Custom…</SelectItem>
          </SelectContent>
        </Select>
        {preset === CUSTOM && !timeControlLocked && (
          <Input
            value={customTc}
            onChange={(e) => setCustomTc(e.target.value)}
            placeholder="minutes+increment, e.g. 7+2"
            aria-label="Custom time control"
            aria-invalid={!!fieldErrors.timeControl}
          />
        )}
        <p className="text-xs text-muted-foreground">
          {timeControlLocked
            ? "Locked: games may already be in progress."
            : "Minutes per player + seconds added after each move."}
        </p>
        {fieldErrors.timeControl && (
          <p className="text-sm text-destructive">{fieldErrors.timeControl}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="t-start">Starts (IST)</Label>
        <Input
          id="t-start"
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          aria-invalid={!!fieldErrors.startsAt}
        />
        {fieldErrors.startsAt && (
          <p className="text-sm text-destructive">{fieldErrors.startsAt}</p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={mutation.isPending || !name.trim() || !startsAt || !timeControl}
        >
          {mutation.isPending && <Loader2 className="animate-spin" />}
          {editing ? "Save changes" : "Create tournament"}
        </Button>
      </DialogFooter>
    </form>
  );
}
