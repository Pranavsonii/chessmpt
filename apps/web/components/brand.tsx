import Link from "next/link";
import { cn } from "@/lib/utils";

export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 font-extrabold tracking-tight", className)}>
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-lg bg-primary text-lg text-primary-foreground"
      >
        ♚
      </span>
      <span className="leading-none">
        <span className="text-brand">Kingdom</span>{" "}
        <span className="text-primary">of Chess</span>
      </span>
    </Link>
  );
}
