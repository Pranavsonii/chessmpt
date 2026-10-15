# Kingdom of Chess: a tournament, played live

A tournament module with live 1-on-1 chess. A **coach** creates and runs tournaments.
**Students** join, press **Find opponent**, are auto-paired and dropped straight into a
real-time game with a shared clock. Every result feeds a live leaderboard, and the
winner is declared when the coach completes the tournament.

The whole path **join a tournament → play a match → see it on the leaderboard** works
end to end, in two browsers, with no manual refresh.

- [Tech stack](#tech-stack)
- [Setup](#setup) (Docker one-command, or manual)
- [Seed credentials](#seed-credentials)
- [How to play a match locally](#how-to-play-a-match-locally)
- [What was built, requirement by requirement](#what-was-built-requirement-by-requirement)
- [API & real-time conventions](#06--api--real-time-conventions) (REST endpoints, **Socket.IO event list**)
- [Tests](#07--tests)
- [Stretch goals](#stretch-goals)
- [Decisions & trade-offs](#decisions--trade-offs)
- [Known limitations & what I'd do next](#known-limitations)
- [Repository layout](#repository-layout)

---

## Tech stack

Matches the stack in the brief.

| Backend | Frontend |
| ------- | -------- |
| **NestJS 11**, TypeScript strict mode | **Next.js 16** (App Router) + **React 19**, strict |
| **Drizzle ORM** + **PostgreSQL 16** (SQL migrations committed) | **TailwindCSS 4** + **shadcn/ui** |
| **Socket.IO** for real-time | **TanStack React Query** for REST |
| **class-validator** DTOs on every input | **Socket.IO client** for live play |
| **chess.js** (server-side rules, PGN) | **chess.js** + **react-chessboard** |
| **Docker Compose** (db + api + web) | |

Tooling: npm workspaces (one `npm install`, one lockfile), Jest + supertest, ESLint, Prettier. Node 22 (`.nvmrc`).

---

## Setup

### Option A: Docker, one command

Requires only Docker.

```bash
docker compose up --build
```

Open **http://localhost:3000**. The API container applies the migrations and runs the
(idempotent) seed on start, so there is nothing else to do.

| Service | URL |
| ------- | --- |
| Web | http://localhost:3000 |
| API | http://localhost:4000/api/v1/health |
| Postgres | `localhost:5433` (user / password / db: `chess`) |

If a port is taken, set `WEB_PORT`, `API_PORT` or `POSTGRES_PORT` in a `.env` file
(see `.env.example`). The demo uses a placeholder `JWT_SECRET` unless you set one.

### Option B: manual setup (development)

Requires **Node 22+** and Docker (for Postgres only, or bring your own Postgres, see below).

**1. Environment.** One `.env` at the repo root serves both apps.

```bash
cp .env.example .env
```

The defaults work as they are. The variables:

| Variable | Used by | Meaning |
| -------- | ------- | ------- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` | docker compose | Postgres container settings (host port 5433) |
| `DATABASE_URL` | api | Postgres connection string |
| `JWT_SECRET` | api | signing secret, at least 32 chars (the API refuses to boot without it) |
| `JWT_TTL_SECONDS` | api | session length, default 8 h |
| `NODE_ENV` | api | `development` locally (`production` in Docker) |
| `API_PORT` | api, docker compose | API port, default 4000; also the api container's host port |
| `WEB_ORIGIN` | api | the browser origin allowed by CORS and Socket.IO |
| `COOKIE_SECURE` | api | optional, not in `.env.example`; forces the cookie's `Secure` flag on or off (unset = on in production) |
| `API_INTERNAL_URL` | web | where Next.js forwards `/api/*` (server side) |
| `NEXT_PUBLIC_SOCKET_URL` | web | where the browser opens the Socket.IO connection |
| `WEB_PORT` | docker compose | host port of the web container, default 3000 (Docker demo only) |

**2. Install.**

```bash
npm install
```

**3. Postgres.** The easiest is the bundled container:

```bash
npm run db:up
```

This starts Postgres 16 on host port **5433**, so it never clashes with a locally
installed Postgres on 5432. Any other Postgres 14+ works too (local install,
Supabase, Neon): create a database and point `DATABASE_URL` at it.

**4. Migrations and seed.**

```bash
npm run db:migrate
npm run db:seed
```

Migrations are the committed SQL files in `apps/api/drizzle/`. The seed is idempotent
(safe to run twice): 1 coach, 6 students, two **open** tournaments
(*Diwali Blitz Cup* 5+0, *Bullet Practice* 1+0) and one **draft** (*Weekend Rapid* 10+5).

**5. Start both apps** (two terminals).

```bash
npm run dev:api
```

```bash
npm run dev:web
```

API on http://localhost:4000/api/v1, web on **http://localhost:3000**.

### Scripts

| Command | What it does |
| ------- | ------------ |
| `npm run db:up` / `npm run db:down` | start / stop the Postgres container |
| `npm run db:migrate` | apply migrations |
| `npm run db:seed` | seed users and tournaments |
| `npm run db:generate` | generate a new migration from `schema.ts` |
| `npm run db:studio` | browse the database (Drizzle Studio) |
| `npm run dev:api` / `npm run dev:web` | run the apps in watch mode |
| `npm test` | API unit tests |
| `npm run test:e2e -w apps/api` | HTTP-level tests (envelope, guards) |
| `npm run build` / `npm run lint` | build / lint both apps |

---

## Seed credentials

| Role | Email | Password |
| ---- | ----- | -------- |
| Coach | `coach@koc.test` | `Coach@123` |
| Student | `aarav@koc.test` | `Student@123` |
| Student | `diya@koc.test` | `Student@123` |
| Student | `vihaan@koc.test` | `Student@123` |
| Student | `ananya@koc.test` | `Student@123` |
| Student | `arjun@koc.test` | `Student@123` |
| Student | `ishaan@koc.test` | `Student@123` |

---

## How to play a match locally

The login cookie is shared by every tab of one browser profile, so each player needs
their own browser or profile: e.g. a normal Chrome window, an Incognito window, and
Firefox.

1. **Students join.** In window A log in as `aarav@koc.test`, in window B as
   `diya@koc.test`. Each opens **Diwali Blitz Cup** (status *Open*) and clicks **Join**.
2. **Coach starts it.** In window C log in as `coach@koc.test`, open the same
   tournament and click **Start tournament** (status becomes *Ongoing*; it needs at
   least 2 joined students). The students' pages update by themselves.
3. **Find opponent.** Both students click **Find opponent**. The server pairs them
   and pushes `match:found`; both are taken to the board automatically.
4. **Play.** White moves first. Each move appears on the other board at once, the
   clocks tick on both screens from the server's time, and the PGN panel grows.
   Try a quick mate (as White: e4, Bc4, Qh5, Qxf7#), resign, or let a clock run out.
   Refresh mid-game: the board and clocks come back as they were.
5. **Result.** Both players see the result dialog. The tournament page's leaderboard
   and results update live. Click **Find opponent** again to play the next game.
6. **Complete.** As the coach, click **Complete tournament** once no game is in
   progress. The winner (or co-winners) is declared on the leaderboard.

Students can also see their **Schedule** (joined tournaments + the game in progress)
and **History** (finished games) from the top navigation.

---

## What was built, requirement by requirement

### 01 · Auth & roles

- Email + password login (`POST /api/v1/auth/login`) issues a **JWT in an httpOnly
  cookie** (`access_token`, `SameSite=Lax`, `Secure` in production). Passwords are
  bcrypt-hashed.
- **Every route is protected by default**: a global `JwtAuthGuard` runs on all
  routes, and only routes marked `@Public()` (login, logout, health) skip it. A global
  `RolesGuard` reads `@Roles('coach' | 'student')`. Students get **403** on coach
  endpoints and vice versa; no cookie gets **401**.
- **Frontend**: `proxy.ts` (Next 16's middleware) redirects a student away from
  `/coach/*`, a coach away from `/student/*`, and anyone logged out to `/login`. This
  is UX only; the API guards are the real enforcement.
- `GET /api/v1/me` returns the current user.
- **Socket.IO is authenticated** at the handshake with the same cookie; a bad or
  missing cookie is rejected before any handler runs. The server only lets a match's
  two players join its room.
- Seeded users: 1 coach and 6 students (above).

### 02 · Coach: tournament management

- **CRUD**: name, time control written as `minutes+increment` (e.g. `5+0`, `5+3`),
  start date/time, and status.
- **Status** is a forward-only state machine: `draft → open → ongoing → completed`.
  Drafts are visible only to the coach and are the only ones that can be deleted.
  The time control locks once the tournament is ongoing.
- **Participants: students self-join** (my call). The coach sees the participant list.
- **Stats**: leaderboard with points, W/D/L and tiebreak, rankings, every match with
  its result and how it ended, live games, and the **winner** once completed.
- **No manual pairing**: the coach only starts the tournament; matchmaking decides
  the opponents.

### 03 · Student: join & get matched

- Browse open and ongoing tournaments and **join an open one**.
- **Find opponent** enters the tournament's matchmaking queue (`POST
  /tournaments/:id/queue`). The server auto-pairs two waiting players, creates the
  match and pushes **`match:found`** to both over Socket.IO; the client navigates
  straight to the board.
- After a game, the player can **re-queue**, and see the leaderboard, their rank,
  their schedule and their match history.
- **Matchmaking rules / concurrency**: a player is in **at most one match at a time**.
  The `player_active_match` table has the user id as its primary key, and the rows for
  both players are inserted in the same transaction that creates the match, so even
  two racing pairing attempts cannot double-book anyone. Pairing is FIFO, prefers
  opponents a player hasn't met yet, and balances colours.

### 04 · Live match play

- **Two-way move sync**: a move is sent as `match:move`; the server validates it and
  broadcasts `match:moved` to both players' match room.
- **Shared clock**: the server owns it. Every broadcast carries both players'
  remaining time and the server's timestamp; clients only interpolate between updates.
  A server timer ends the game **on time** even if both tabs are closed.
- **PGN log**: built by chess.js, shown live in the PGN panel (with copy), and
  persisted on the match. Every ply is also stored in a `moves` table.
- **Game end**: checkmate, resignation, timeout, stalemate, insufficient material,
  threefold repetition and the 50-move rule. The result is saved in the same
  transaction that frees both players, and the leaderboard updates live.
- **Server-authoritative** (the "mid-level bar"): the browser sends only intent
  (`from`, `to`, `promotion`, `ply`). Turn order, legality and time are decided on the
  server, so a tampered client can't cheat or desync.

### 05 · Leaderboard & rankings

- Standard scoring: **win = 1, draw = ½, loss = 0**.
- Sorted by points. **Tiebreak** (documented choice):
  1. **Points**
  2. **Sonneborn-Berger**: the sum of the scores of the opponents you beat, plus half
     the scores of the opponents you drew. It rewards results against strong players.
  3. **Number of wins**
  4. **Head-to-head**, only when exactly two players are still tied
  5. Still tied: they **share the rank** (competition ranking 1, 2, 2, 4)
- **Winner on completion**: stored on the tournament when the coach completes it. A
  shared first place has no single winner; the leaderboard lists the co-winners.
- Aborted games (White never moved) never count.

### 06 · API & real-time conventions

See [the full reference below](#06--api--real-time-conventions).

### 07 · Tests

See [Tests](#07--tests).

### 08 · Frontend

- Pages: login; coach dashboard and tournament detail (create/edit dialog, status
  actions, participants, leaderboard, results); student browse, tournament detail with
  **Find opponent**, schedule, history; and the **live board** with clocks, PGN panel,
  resign and a result dialog.
- **TanStack Query** for all REST data, with query keys in one place
  (`lib/query-keys.ts`) and **cache invalidation after every mutation** (join, status
  change, create, edit, delete). Socket pushes (`tournament:updated`, `match:ended`)
  also invalidate the related queries.
- **Socket.IO client**: one connection per session, with a connection status badge.
  Emits use acknowledgements with a timeout, so nothing hangs.
- **Loading, error and empty states everywhere**: skeletons while loading, an error
  card with a retry button, empty states with a hint, toasts for failed actions, and
  disabled buttons while a request is in flight.
- Dates are shown as **DD/MM/YYYY** in IST.

### 09 · README

This file.

---

## 06 · API & real-time conventions

### Versioning

URI versioning: every endpoint is under **`/api/v1`**. A breaking change would ship as
`/api/v2` while `/v1` keeps working.

### Standard request / response format

Requests are JSON bodies validated by **class-validator DTOs** (global `ValidationPipe`
with `whitelist` + `forbidNonWhitelisted`: unknown fields are rejected, which blocks
mass assignment such as sending `role: "coach"`). Path ids are checked as UUIDs.

Every response has one of two shapes:

```jsonc
// success
{ "success": true, "data": { ... }, "meta": { ... } }

// error
{ "success": false, "error": { "code": "TOURNAMENT_NOT_OPEN", "message": "Registration is closed: ...", "details": null } }
```

HTTP status codes: `200` OK, `201` created, `204` no content, `400` validation error
(with per-field `details`), `401` not logged in, `403` wrong role or not your game,
`404` not found (students get 404 for drafts), `409` conflict with the current state
(already joined, wrong status, already in a match), `422` illegal move, `500` with a
generic message (details are logged, never leaked).

Error codes: `VALIDATION_ERROR`, `NOT_AUTHENTICATED`, `INVALID_SESSION`,
`INVALID_CREDENTIALS`, `FORBIDDEN_ROLE`, `NOT_FOUND`, `TOURNAMENT_NOT_FOUND`,
`ONLY_STUDENTS_CAN_JOIN`, `ALREADY_JOINED`, `TOURNAMENT_NOT_OPEN`,
`TOURNAMENT_NOT_ONGOING`, `TOURNAMENT_COMPLETED`, `TOURNAMENT_NOT_DRAFT`,
`INVALID_STATUS_TRANSITION`, `STATUS_CHANGED_CONCURRENTLY`, `NOT_ENOUGH_PLAYERS`,
`MATCHES_IN_PROGRESS`, `TIME_CONTROL_LOCKED`, `NOT_A_PARTICIPANT`, `ALREADY_IN_MATCH`,
`MATCH_NOT_FOUND`, `NOT_A_PLAYER`, `NOT_YOUR_TURN`, `STALE_PLY`, `ILLEGAL_MOVE`,
`GAME_OVER`, `INTERNAL_ERROR`.

### REST endpoints

Base URL `/api/v1`. The web app proxies `/api/*` to the API, so the browser only ever
talks to one origin and the cookie is first-party.

| Method & path | Access | Purpose |
| ------------- | ------ | ------- |
| `POST /auth/login` | public | `{ email, password }` → sets the cookie, returns the user |
| `POST /auth/logout` | public | clears the cookie (204) |
| `GET /me` | logged in | the current user `{ id, email, name, role }` |
| `GET /health` | public | liveness |
| `GET /tournaments?status=open,ongoing&joined=true` | both | list (students never see drafts) |
| `GET /tournaments/:id` | both | one tournament |
| `GET /tournaments/:id/participants` | both | joined students |
| `GET /tournaments/:id/leaderboard` | both | standings rows + `winners` once completed |
| `GET /tournaments/:id/matches` | both | every game: players, status, result, termination |
| `POST /tournaments` | coach | create `{ name, timeControl: "5+0", startsAt }` (starts as draft) |
| `PATCH /tournaments/:id` | coach | edit name / start / time control |
| `PATCH /tournaments/:id/status` | coach | `{ status }`, forward-only transition |
| `DELETE /tournaments/:id` | coach | delete a draft (204) |
| `POST /tournaments/:id/join` | student | join an open tournament (201) |
| `POST /tournaments/:id/queue` | student | Find opponent → `{ state: "searching" \| "matched", ... }` |
| `GET /tournaments/:id/queue` | student | queue status (fallback to the socket push) |
| `DELETE /tournaments/:id/queue` | student | cancel (204, idempotent) |
| `GET /me/schedule` | student | joined, unfinished tournaments + the active game |
| `GET /me/matches` | student | finished games, newest first |

### Socket.IO events

Namespace **`/game`**, on the API origin (`NEXT_PUBLIC_SOCKET_URL`). The handshake is
authenticated with the `access_token` cookie; a missing or invalid one fails with a
`connect_error` whose `data` is `{ code: "UNAUTHORIZED" }`.

Every client → server event takes an **acknowledgement** callback that receives
`{ ok: true, data }` or `{ ok: false, error: { code, message } }` (the same error codes
as REST). Payloads are validated with class-validator DTOs.

Rooms are chosen by the server, never by the client: `user:{id}` (every tab of a
user, joined on connect), `match:{id}` (the two players), `tournament:{id}` (anyone
viewing that tournament).

| Event | Direction | Payload | Ack / notes |
| ----- | --------- | ------- | ----------- |
| `match:join` | client → server | `{ matchId }` | ack: full **snapshot** `{ matchId, tournament, white, black, status, result, termination, fen, pgn, moves[], turn, ply, clock, firstMoveDeadline }`. Only the match's two players may join. Sent on page load **and on every reconnect**. |
| `match:move` | client → server | `{ matchId, from: "e2", to: "e4", promotion?: "q"\|"r"\|"b"\|"n", ply }` | ack: `{ ply }`. `ply` = the half-move this would be; a duplicate or stale send is rejected with `STALE_PLY`. Errors: `NOT_YOUR_TURN`, `ILLEGAL_MOVE`, `GAME_OVER`, `NOT_A_PLAYER`. |
| `match:resign` | client → server | `{ matchId }` | ack: `{ matchId }` |
| `match:leave` | client → server | `{ matchId }` | ack: `{ matchId }`; leaves the room |
| `tournament:watch` | client → server | `{ tournamentId }` | ack: `{ tournamentId }`; same visibility rule as REST (students can't watch drafts) |
| `tournament:unwatch` | client → server | `{ tournamentId }` | ack: `{ tournamentId }` |
| `match:found` | server → client (`user:{id}` of both players) | `{ matchId, tournamentId, tournamentName, white: { id, name }, black: { id, name } }` | the client navigates to `/student/play/:matchId` |
| `match:moved` | server → client (`match:{id}`) | `{ matchId, move: { ply, san, from, to }, fen, pgn, turn, ply, clock }` | after every accepted move |
| `match:ended` | server → client (`match:{id}`) | `{ matchId, tournamentId, status: "completed"\|"aborted", result: "1-0"\|"0-1"\|"1/2-1/2"\|null, termination, winnerId, fen, pgn, clock }` | `termination`: `checkmate`, `resignation`, `timeout`, `stalemate`, `insufficient_material`, `threefold_repetition`, `fifty_move_rule` |
| `tournament:updated` | server → client (`tournament:{id}`) | `{ tournamentId, status? }` | a nudge with no data: clients refetch over REST. Sent on status change, game start and game end. |

`clock` is always `{ whiteMs, blackMs, running: "white"|"black"|null, serverNow }`:
remaining time as of `serverNow`, and which clock is ticking.

---

## 07 · Tests

```bash
npm test                        # 130 unit tests, 14 suites, ~4 s, no database
npm run test:e2e -w apps/api    # HTTP envelope + guards via supertest
```

The rules live in pure functions with injected time (`now`) and randomness, so they
are tested without a database, sockets or timers:

| Area the brief asks for | Spec |
| ----------------------- | ---- |
| **Result → leaderboard scoring** | `tournaments/domain/standings.spec.ts` (points, W/D/L, Sonneborn-Berger, head-to-head, shared ranks, co-winners, aborted games ignored), `matches/domain/outcome.spec.ts` |
| **Join rules** | `tournaments/domain/join-rules.spec.ts` (role, draft invisibility, already joined, closed registration), `matchmaking/domain/queue-rules.spec.ts` (participant, one match at a time, ongoing only) |
| **Move / turn validation** | `game/domain/live-game.spec.ts` (not a player, wrong turn, stale ply, illegal move, promotion, every game ending, flag fall before a move arrives, first-move abort), `game/domain/clock.spec.ts` (ticking, increment, stop, timeouts) |
| Other rules | status machine, time-control parsing, pairing (FIFO, rematch avoidance, colour balancing), env validation, roles guard, auth service, socket cookie parsing, exception filter |
| HTTP conventions (e2e) | envelope shape, `/api/v1` versioning, 400 validation details, unknown-field rejection, 401 / 403 guards, logout |

As the brief suggests, the socket wiring itself is not unit-tested: the gateway is
thin glue (authenticate, validate, delegate to the tested engine, ack). It was checked
by hand with two browsers.

---

## Stretch goals

| Stretch goal | Status |
| ------------ | ------ |
| Server-authoritative game state | **Done**: the server validates every move and owns the clock |
| Reconnection (refresh or drop mid-game) | **Done**: `match:join` on every (re)connect returns a full snapshot; the clock is stored as "time left when the turn started", so nothing is lost. Games also survive an API restart (rebuilt from the `moves` table). |
| Increment time controls (`5+3`) | **Done** |
| Threefold repetition, 50-move rule | **Done** (automatic draws, plus insufficient material) |
| Draw offers | Not done (the `draw_agreement` termination already exists in the schema) |
| Spectator mode (coach watches) | Not done; the coach sees live games listed with live updates |
| Standings-based matchmaking | Not done; FIFO with rematch avoidance |
| Full round-robin completion | Partly: rematch avoidance makes everyone meet new opponents first; the coach completes the tournament manually |
| Move-list navigation | Not done |
| DD/MM/YYYY dates + timezone | **Done**: stored in UTC, shown as `DD/MM/YYYY, HH:mm IST`; the coach's date input is read as IST whatever the browser timezone |

---

## Decisions & trade-offs

**The server is the source of truth for the game and the clock.**
The browser sends only an intent. The server checks the turn, the ply number and the
legality (chess.js), charges thinking time from its own clock, and broadcasts the new
state. The client shows its own move optimistically and replaces it with whatever the
server says. *Why:* two clients can never disagree, and a tampered client can't cheat.
*Cost:* each move takes a round trip before it is final, which is fine at classroom
latency.

**The clock is stored, not ticked.** For each side I store the time left when the
current turn started, plus `turnStartedAt`. Time left now is
`stored − (now − turnStartedAt)`. *Why:* there is no counter to drift or to save every
second, a reconnect or restart just recomputes it, and one server timer per game fires
exactly at flag fall. Clients interpolate from the server's `serverNow`.
*Caveats:* no clock runs before White's first move (players may still be loading the
page); if White doesn't move within 60 s the game is **aborted** without a result. A
flag fall is always a win, even when FIDE would call it a draw because the opponent
couldn't possibly mate (simplification).

**`ply` on every move.** The client says which half-move it is sending. A retried or
out-of-order message is rejected with `STALE_PLY`, and the client resyncs from a
snapshot. This makes moves idempotent without a separate message id.

**In-memory live games, written through to Postgres.** Active games live in memory
(one chess.js instance each) and every move is written to `matches` + `moves` in order
(a per-game write queue). On boot the engine reloads every active match. *Why:* fast,
simple, and restart-safe. *Trade-off:* it assumes one API process (see limitations).

**No double-booking, guaranteed by the database.** `player_active_match` has
`user_id` as its primary key. Both rows are inserted in the transaction that creates
the match and deleted in the one that ends it. The in-memory queue is only the fast
path; even if two pairings race, Postgres rejects the second one and nobody ends up in
two games. I chose a lock table over two partial unique indexes on `matches` because
one constraint covers both colours.

**Matchmaking: FIFO with rematch avoidance.** Each tournament has an in-memory queue.
Walking it oldest-first, each player is paired with the oldest waiter they haven't
played yet; a rematch is allowed after 15 s of waiting so nobody waits forever near the
end. Whoever has had White fewer times gets White. Pairing ("pick two and remove them")
happens with no `await` in between, so two runs can't pick the same player, and only
one run per tournament runs at a time. The match is created in one transaction that
holds `FOR SHARE` on the tournament row, so the coach can't complete the tournament
halfway through a pairing. *Trade-off:* the queue is lost on restart (players just
click Find opponent again).

**Students self-join; the coach doesn't pick players.** Simpler for the coach, and it
matches the brief's "no manual pairing". Students can join only while the tournament is
**open**, and can queue only while it is **ongoing**, so the field is fixed once games
start.

**Forward-only tournament status.** `draft → open → ongoing → completed`. Going back
would let people join mid-competition or change a declared winner. Status changes use
optimistic concurrency (`UPDATE … WHERE status = :from`). Completing takes a
`FOR UPDATE` row lock, refuses while a game is live (`MATCHES_IN_PROGRESS`), and stores
the winner in the same transaction.

**Integer scores.** Points are stored as half-points (win 2, draw 1, loss 0) and
Sonneborn-Berger as quarter-points, so sums and tie comparisons are exact with no
floating point. Fractions (`2½`) only appear in the UI.

**Standings are computed on read.** The leaderboard is calculated from completed
matches each time it is requested, not kept in a separate table. *Why:* it can never
drift from the results, and the tiebreak needs every opponent's final score anyway.
*Trade-off:* it reads all games of the tournament per request, which is trivial at this
size; a large event would cache it or update it when a game ends.

**Tiebreak: Sonneborn-Berger first.** With auto-matchmaking, players don't all play
the same number of games or the same opponents, so Sonneborn-Berger (quality of the
opponents you scored against) is a fairer first tiebreak than head-to-head, which often
doesn't exist. Wins and a two-way head-to-head follow; anyone still level shares the
rank rather than being split by an arbitrary rule.

**Real-time events are nudges, REST stays the source of truth for pages.**
`tournament:updated` carries no data; it tells open pages to refetch through TanStack
Query. Only the live board receives full state over the socket, because it needs
sub-second updates. *Why:* one code path for loading and refreshing data, one place for
access rules.

**Modules talk through events.** Matchmaking emits `match.found`; the game module
listens, starts tracking the match and pushes `match:found`. Neither imports the other,
which avoids a circular dependency and keeps matchmaking testable without sockets.

**Auth: JWT in an httpOnly cookie, behind a same-origin proxy.** JavaScript can't read
the cookie (an XSS bug can't steal it). `SameSite=Lax` plus a JSON-only API and a locked
CORS origin cover CSRF. Next.js forwards `/api/*` to NestJS, so the cookie is
first-party and `proxy.ts` can read it for redirects. Socket.IO connects directly to
the API (rewrites don't proxy WebSockets reliably); the cookie is still sent because
cookies are scoped by host, not port. Login returns the same error for a wrong email and
a wrong password and compares against a dummy hash for unknown emails, so neither the
message nor the timing reveals which emails exist. *Trade-off:* a stateless JWT can't be
revoked before it expires (8 h); a refresh token or denylist would fix that.

**Secure by default.** Every route needs a login unless it is marked `@Public()`, so
forgetting a decorator fails closed (401) instead of open.

**Time controls stored as two integers.** `"5+3"` is parsed once at the edge into
`initialSeconds = 300`, `incrementSeconds = 3`. Each match copies the time control when
it is created, so editing a tournament can never change a game in progress.

**Dates.** Stored as `timestamptz` (UTC); converted to IST only for display. IST has no
daylight saving, so a fixed +05:30 offset is exact.

**npm workspaces.** npm ships with Node, so a clean machine needs nothing extra; the
two apps share one lockfile and one install.

---

## Known limitations

- **Single API instance.** The matchmaking queue and live games are in process. The
  database stays correct, and unfinished games are rebuilt after a restart, but
  running several instances would need the queue in Redis/Postgres and the Socket.IO
  Redis adapter with sticky sessions.
- A student joining doesn't push `tournament:updated`, so the coach's participant list
  refreshes on the next update or a reload.
- The Docker demo seeds on every start (seed passwords are reset) and uses a
  placeholder `JWT_SECRET` unless you set one.
- No draw offers, spectator mode or move-list navigation yet.

## What I'd do next

1. Draw offers, and a coach spectator view (the room model already supports it: a
   read-only join of `match:{id}` for coaches).
2. Move-list navigation on the board (the `moves` table already stores every
   position).
3. Standings-based pairing and an automatic round-robin completion.
4. Redis for the queue and the Socket.IO adapter; refresh tokens.
5. Playwright end-to-end tests that drive two browsers through a full game.

---

## Repository layout

```
apps/
  api/                          NestJS 11
    drizzle/                    SQL migrations (committed)
    src/
      auth/                     login/logout, /me, JWT cookie, global auth + roles guards
      common/                   response envelope, exception filter, validation pipe, domain events
      config/                   env validation (fails fast on a bad .env)
      db/                       schema, client, migrate, seed
      tournaments/              CRUD, join, status machine, standings  (domain/ = pure rules + tests)
      matchmaking/              queue, pairing                         (domain/ = pure rules + tests)
      matches/                  result → points
      game/                     Socket.IO gateway, MatchEngine, clock + move rules (domain/)
      players/                  /me/schedule, /me/matches
    test/                       e2e tests
  web/                          Next.js 16
    app/login, app/coach, app/student (play/[matchId] = live board)
    components/                 game (board, clocks, PGN), tournaments, matchmaking, shadcn ui
    lib/                        api client, query keys, socket provider, live match hook, date/score formatting
    proxy.ts                    role-based redirects
docker-compose.yml              db + api + web
.env.example
```
