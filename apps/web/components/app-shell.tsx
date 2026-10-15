"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Brand } from "@/components/brand";
import { SocketStatusBadge } from "@/components/socket-status";
import { ErrorState } from "@/components/states";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { Role } from "@/lib/api/types";
import { useLogout, useMe } from "@/lib/auth";
import { homeFor } from "@/lib/session";
import { SocketProvider } from "@/lib/socket";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

interface AppShellProps {
  role: Role;
  nav: NavItem[];
  children: React.ReactNode;
}

/**
 * Layout for the logged-in areas. Opens the session's real-time socket, loads /me,
 * and if the role doesn't match this area (proxy.ts normally prevents that) sends
 * the user to their own home.
 */
export function AppShell(props: AppShellProps) {
  return (
    <SocketProvider>
      <Shell {...props} />
    </SocketProvider>
  );
}

function Shell({ role, nav, children }: AppShellProps) {
  const me = useMe();
  const logout = useLogout();
  const router = useRouter();
  const pathname = usePathname();
  const wrongArea = me.data && me.data.role !== role;

  useEffect(() => {
    if (wrongArea && me.data) router.replace(homeFor(me.data.role));
  }, [wrongArea, me.data, router]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <Brand href={homeFor(role)} />
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
            {nav.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== homeFor(role) && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                    active && "bg-accent text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {me.data && <SocketStatusBadge />}
            {me.isPending ? (
              <Skeleton className="size-9 rounded-full" />
            ) : me.data ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-10 gap-2 px-2">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                        {initials(me.data.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden text-sm font-medium md:inline">{me.data.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex flex-col gap-1">
                    <span>{me.data.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {me.data.email}
                    </span>
                    <Badge variant="secondary" className="w-fit capitalize">
                      {me.data.role}
                    </Badge>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={logout.isPending}
                    onSelect={() => logout.mutate()}
                  >
                    <LogOut /> {logout.isPending ? "Logging out…" : "Log out"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 sm:hidden" aria-label="Main mobile">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground",
                pathname === item.href && "bg-accent text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {me.isError ? (
          <ErrorState
            title="Couldn't load your account"
            error={me.error}
            onRetry={() => me.refetch()}
          />
        ) : me.isPending || wrongArea ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
