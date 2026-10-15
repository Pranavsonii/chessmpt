import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, homeFor, readSession } from "@/lib/session";

/**
 * Next.js 16 "proxy" (formerly middleware): runs before a page renders.
 * Role-based redirects so a student never even sees a coach screen and vice versa.
 *
 * This is UX, not security: the API's guards are the real enforcement.
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = readSession(req.cookies.get(AUTH_COOKIE)?.value);
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url));

  // Root and login: send logged-in users to their home.
  if (pathname === "/") return to(session ? homeFor(session.role) : "/login");
  if (pathname === "/login") return session ? to(homeFor(session.role)) : NextResponse.next();

  const area = pathname.startsWith("/coach")
    ? "coach"
    : pathname.startsWith("/student")
      ? "student"
      : null;

  if (area) {
    if (!session) {
      return to(`/login?next=${encodeURIComponent(pathname + search)}`);
    }
    if (session.role !== area) return to(homeFor(session.role));
  }

  return NextResponse.next();
}

export const config = {
  // Skip API calls (they go to NestJS), Next internals and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
