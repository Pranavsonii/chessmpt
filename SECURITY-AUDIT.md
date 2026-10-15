# Security & Code Quality Audit: Kingdom of Chess

**Date:** 15/10/2026 · **Scope:** whole monorepo at Phase 10 (`apps/api`, `apps/web`, Docker, config, dependencies) · **Branch with fixes:** `security-audit-ux`

Severity follows OWASP risk rating: **High** = exploitable now with real impact · **Medium** = needs a precondition or limited impact · **Low** = hardening / best practice.

## Summary

| Severity | Found | Fixed in this branch | Open (recommendation) |
|---|---|---|---|
| High | 3 | 3 | 0 |
| Medium | 8 | 7 | 1 |
| Low | 10 | 3 | 7 |

What was already done well: global "secure by default" auth guard (`@Public()` opt-out), httpOnly + SameSite=Lax JWT cookie, timing-safe login (dummy bcrypt hash), `whitelist + forbidNonWhitelisted` validation (blocks mass assignment), uniform error envelope that never leaks internals, parameterised SQL everywhere (Drizzle), Origin check on the WebSocket upgrade, server-authoritative game state, DB-level double-booking guard, optimistic concurrency on status changes.

## Findings

### High

| # | Finding | Where | Fix |
|---|---|---|---|
| H1 | **No brute-force protection on login.** Unlimited password guesses per account (OWASP ASVS 2.2.1). | `auth.controller.ts` | ✅ `LoginRateLimiter`: 5 failures per (client IP, email) per 15 min → `429 TOO_MANY_LOGIN_ATTEMPTS` + `Retry-After`. IP+email keying avoids locking a user out from another network and avoids one school NAT throttling everyone. |
| H2 | **No HTTP security headers** on API or web: no CSP, no clickjacking protection (a framed board could trick a player into "Resign"), no nosniff/HSTS. | `app.setup.ts`, `next.config.ts` | ✅ API: `helmet()` + `x-powered-by` off. Web: CSP (`frame-ancestors 'none'`, `object-src 'none'`, `base-uri`, `form-action`, `connect-src` limited to the socket origin), `X-Frame-Options: DENY`, nosniff, Referrer-Policy, Permissions-Policy, HSTS in prod, `poweredByHeader: false`. |
| H3 | **Tournament name injected into PGN headers.** A name with `"`, `]` or a newline (e.g. `Cup"]\n[Result "1-0`) corrupts every game's PGN `[Event "…"]` tag and can forge header fields. | `tournament.dto.ts` → `domain/pgn.ts` | ✅ Unicode allow-list (`\p{L}\p{M}\p{N}` + everyday punctuation); quotes, brackets, `<>` and control characters rejected. Combining marks are allowed so Hindi/other scripts still work (caught by a test). |

### Medium

| # | Finding | Where | Fix |
|---|---|---|---|
| M1 | **Socket outlives the session.** Auth happens once at the handshake; after the JWT expires (or the user logs out) the socket stays connected and authorised. | `game.gateway.ts` | ✅ `verifySession()` returns the expiry; the gateway disconnects the socket the moment the JWT expires. |
| M2 | **Socket message size 1 MB (default).** Every client message is < 200 bytes; one socket could make the server buffer/parse MBs per message. | `socket-io.adapter.ts` | ✅ `maxHttpBufferSize: 16 KB`. |
| M3 | **Placeholder JWT secret accepted in production.** The `.env.example` value is 50 chars, so it passes `@MinLength(32)`; anyone who read the repo could forge a coach token. | `env.validation.ts` | ✅ Boot refuses that value when `NODE_ENV=production`. `WEB_ORIGIN` is now validated as an http(s) origin. |
| M4 | **Seed resets real accounts to published passwords.** The seed upserts by email; run against production it resets those users to `Coach@123` / `Student@123`. | `db/seed.ts` | ✅ Refuses when `NODE_ENV=production` unless `ALLOW_SEED=true`. |
| M5 | **Real client IP unknown.** Every request arrives via the Next.js rewrite, so `req.ip` was the proxy's address: IP-based limits would throttle all users together. | `app.setup.ts` | ✅ `trust proxy` for loopback/private hops only (can't be spoofed from outside). Verified live through the proxy. |
| M6 | **Ghost players in matchmaking.** `leaveAll()` existed but was never called: a student who closed the tab stayed queued and got paired with an empty chair. | `game.gateway.ts` | ✅ When a student's last socket disconnects (10 s grace for reloads), they leave the queue. |
| M7 | **Vulnerable dependencies in the runtime tree:** 7 High (braces ReDoS via fast-glob ← `shadcn` CLI) listed under `dependencies`. | `apps/web/package.json` | ✅ `shadcn` (build-time CLI + CSS import) moved to `devDependencies`. `npm audit --omit=dev`: **0 vulnerabilities**. Dev tree still reports them; upgrade when shadcn ships a fix. |
| M8 | **Logout doesn't revoke the JWT.** It clears the cookie, but a copied token stays valid for its 8 h lifetime (stateless JWT). | `auth.controller.ts` | ⏳ Open. Recommended: shorter access token (15 min) + refresh token, or a `token_version` column checked in `verifyToken` (bumped on logout / password change). |

### Low

| # | Finding | Fix |
|---|---|---|
| L1 | `startsAt` accepted any date (year 1970 or 9999). | ✅ Create: no earlier than 1 h ago, at most 1 year ahead. Update: at most 1 year ahead (ongoing tournaments legitimately started in the past). |
| L2 | Postgres published on all interfaces (`0.0.0.0:5433`) with default password `chess/chess`. | ✅ Bound to `127.0.0.1` in `docker-compose.yml`. |
| L3 | No client-side validation: users only learn about mistakes after a round trip. | ✅ `lib/validation.ts` mirrors every DTO rule (login, tournament form). The server stays authoritative. |
| L4 | CSP still needs `script-src 'unsafe-inline'` (Next.js inlines scripts). | ⏳ Move to a nonce-based CSP generated in `proxy.ts` (Next.js docs recipe). |
| L5 | No rate limiting on other endpoints (queue join, socket events). | ⏳ Add `@nestjs/throttler` globally (e.g. 100 req/min/IP) and a per-socket event budget. |
| L6 | `GET /tournaments/:id/matches` returns every game's full PGN: the payload grows with the tournament. | ⏳ Drop `pgn` from the list; add `GET /matches/:id/pgn` on demand. Add pagination to the coach tournament list and results. |
| L7 | Leaderboard recomputed on every read and every `tournament:updated`, so all watchers refetch at once (thundering herd). | ⏳ Fine at classroom scale. At scale: debounce the broadcast, or cache standings per tournament and invalidate in `finishMatch`. |
| L8 | Role is read from the JWT, so a role change or account deletion only applies at the next login (8 h). | ⏳ Same remedy as M8 (`token_version`), or re-check the user on sensitive actions. |
| L9 | JWT has no `iss`/`aud` claims; socket event payloads are typed `any`. | ⏳ Add `issuer`/`audience` to sign/verify options; type the Socket.IO event maps. |
| L10 | Health endpoint checks liveness only (no DB) and exposes uptime; no request IDs in logs; API types are hand-copied to the web app. | ⏳ Add `/health/ready` with a DB ping, a request-id middleware, and OpenAPI or a shared types package. |

## UI/UX changes in this branch

- **Password field with show/hide toggle** (`components/ui/password-input.tsx`): a real button with `aria-pressed`/`aria-controls`; keeps focus in the field; disables autocorrect/capitalisation when the password is visible.
- **Errors you can tell apart:** alerts have distinct tint + border + icon per kind (error, warning, success, info), so colour is never the only cue. Full-page errors pick icon and heading by cause (offline, no access, not found, server problem) and show the error code.
- **Dismissible errors:** `Notice` has a close button; every toast has a close button. Error toasts stay 8 s (successes 4 s), and a repeated error replaces itself instead of stacking.
- **Forms:** inline field errors (icon + text, linked with `aria-describedby`), shown after the user leaves a field or submits; focus moves to the first invalid field; login explains *why* it failed (wrong credentials vs locked vs offline).

## Verification

- API: `tsc` and `eslint` clean; **145/145 unit tests** (new: rate limiter, DTO rules incl. the PGN-injection and Hindi-name cases, env checks).
- Web: `tsc` and `eslint` clean.
- Live, against an isolated database: **16/16 checks**. API and web headers present; 5 wrong passwords → 401, 6th → 429 with `Retry-After: 900`, through the Next proxy; the lock is scoped to that IP + email; the PGN-breaking name and a past start time are rejected with field errors.
- Browser: an empty login submit shows both inline errors; the toggle reveals the password and keeps focus.
