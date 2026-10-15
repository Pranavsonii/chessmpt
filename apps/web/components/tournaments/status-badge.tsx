import { Badge } from "@/components/ui/badge";
import type { TournamentStatus } from "@/lib/api/types";
import { STATUS_LABEL } from "@/lib/tournaments";
import { cn } from "@/lib/utils";

const STYLE: Record<TournamentStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-sky-100 text-sky-800",
  ongoing: "bg-brand/15 text-orange-800",
  completed: "bg-emerald-100 text-emerald-800",
};

export function StatusBadge({ status, className }: { status: TournamentStatus; className?: string }) {
  return (
    <Badge className={cn("gap-1.5 font-semibold", STYLE[status], className)}>
      {status === "ongoing" && (
        <span className="relative flex size-2" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-brand" />
        </span>
      )}
      {STATUS_LABEL[status]}
    </Badge>
  );
}
