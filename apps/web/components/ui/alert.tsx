import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg border px-2.5 py-2 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    // Each kind has its own tint, border and icon colour, so an error never looks
    // like an info note (and colour is never the only cue: the icon differs too).
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        info: "border-sky-300 bg-sky-50 text-sky-900 *:data-[slot=alert-description]:text-sky-900/80 *:[svg]:text-sky-600 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100",
        success:
          "border-emerald-300 bg-emerald-50 text-emerald-900 *:data-[slot=alert-description]:text-emerald-900/80 *:[svg]:text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
        warning:
          "border-amber-300 bg-amber-50 text-amber-950 *:data-[slot=alert-description]:text-amber-950/80 *:[svg]:text-amber-600 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
        destructive:
          "border-destructive/40 bg-destructive/10 text-destructive *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current dark:bg-destructive/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
