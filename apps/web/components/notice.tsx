"use client";

import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type Kind = "error" | "warning" | "success" | "info";

const STYLE: Record<Kind, { variant: "destructive" | "warning" | "success" | "info"; icon: typeof Info }> = {
  error: { variant: "destructive", icon: CircleAlert },
  warning: { variant: "warning", icon: TriangleAlert },
  success: { variant: "success", icon: CircleCheck },
  info: { variant: "info", icon: Info },
};

/**
 * An inline message box. The kind sets tint, border AND icon, so errors stand out
 * from warnings and notes even without colour. Pass `onDismiss` to show a close
 * button. Errors are announced immediately (role="alert"); other kinds politely.
 */
export function Notice({
  kind,
  title,
  children,
  onDismiss,
  className,
}: {
  kind: Kind;
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  const { variant, icon: Icon } = STYLE[kind];
  return (
    <Alert
      variant={variant}
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
      className={cn(onDismiss && "pr-10", className)}
    >
      <Icon />
      {title && <AlertTitle className="font-semibold">{title}</AlertTitle>}
      <AlertDescription>{children}</AlertDescription>
      {onDismiss && (
        <AlertAction className="top-1.5 right-1.5">
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss message"
            className="flex size-7 items-center justify-center rounded-md opacity-70 transition hover:bg-black/5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </AlertAction>
      )}
    </Alert>
  );
}

/** Inline message under a form field. Link it with aria-describedby={id} on the input. */
export function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="flex items-start gap-1.5 text-sm text-destructive">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {children}
    </p>
  );
}
