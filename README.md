# Kingdom of Chess: tournaments with live 1-on-1 chess

A coach creates and runs tournaments. Students join, are paired with an opponent
and play real-time chess. The server owns the game and the clock. Results feed a
live leaderboard, and the winner is declared when the coach completes the tournament.

| Layer    | Tech |
| -------- | ---- |
| API      | NestJS 11, Socket.IO, Drizzle ORM, PostgreSQL 16, JWT (httpOnly cookie), chess.js |
| Web      | Next.js 16 (App Router), React 19, Tailwind, shadcn/ui, TanStack Query, socket.io-client, chess.js, react-chessboard |
| Tooling  | npm workspaces, Jest + supertest, Docker Compose |

## Quick start (Docker, one command)

```bash
docker compose up --build
```

Then open **http://localhost:3000**. The API container runs migrations and the
seed on start, so there is nothing else to do. If a port is taken, set `WEB_PORT`,
`API_PORT` or `POSTGRES_PORT` (see `.env.example`).

## Manual setup (for development)

Requires Node 22+ and Docker (for Postgres only).

```bash
cp .env.example .env        # defaults work as they are
npm install
npm run db:up               # Postgres 16 on host port 5433
npm run db:migrate          # apply the committed SQL migrations
npm run db:seed             # 1 coach, 6 students, 3 open tournaments (idempotent)
npm run dev:api             # http://localhost:4000/api/v1/health
npm run dev:web             # http://localhost:3000   (second terminal)
```

Postgres is published on **5433** so it never clashes with a locally installed
Postgres on 5432.

### Seed accounts

| Role    | Email                                                                  | Password      |
| ------- | ---------------------------------------------------------------------- | ------------- |
| Coach   | `coach@koc.test`                                                       | `Coach@123`   |
| Student | `aarav@koc.test`, `diya@koc.test`, `vihaan@koc.test`, `ananya@koc.test`, `arjun@koc.test`, `ishaan@koc.test` | `Student@123` |

## How to play a match locally

1. Window 1: log in as **coach**, open a seeded tournament (or create one), make
   sure it is **Open** and press **Start tournament**. It needs at least 2 joined
   students.
2. Window 2 (Chrome): log in as `aarav@koc.test`. Window 3 (an **Incognito**
   window, or another browser, because the login cookie is shared per browser): log
   in as `diya@koc.test`.
3. Both students open the tournament, **join it before the coach starts it**, then
   press **Find opponent**. When paired, both are taken to the board.
4. Play. Moves, clocks, resignation and results sync live. Back on the tournament
   page the leaderboard updates by itself. The coach can then press **Complete
   tournament** to declare the winner.

## Scripts

| Command                   | What it does |
| ------------------------- | ------------ |
| `npm run db:up` / `db:down` | start / stop the Postgres container |
| `npm run db:generate`     | create a new migration from `schema.ts` |
| `npm run db:migrate`      | apply migrations |
| `npm run db:seed`         | seed users and tournaments |
| `npm run db:studio`       | browse the database |
| `npm test`                | unit tests (API) |
| `npm run test:e2e -w apps/api` | HTTP-level tests with supertest |
| `npm run build` / `lint`  | build / lint both apps |

## API

Base URL `/api/v1` (the web app proxies `/api/*` to the API, so the auth cookie is
first-party). Every response uses one envelope:

```jsonc
{ "success": true,  "data": { ... }, "meta": { ... } }
{ "success": false, "error": { "code": "NOT_YOUR_TURN", "message": "...", "details": ... } }
```

### REST

| Method & path | Who | Purpose |
| ------------- | --- | ------- |
| `POST /auth/login` | public | email + password → sets the `access_token` cookie |
| `POST /auth/logout` | public | clears the cookie (204) |
| `GET /me` | any | the current user |
| `GET /tournaments?status=open,ongoing&joined=true` | any | list (students never see drafts) |
| `GET /tournaments/:id` | any | one tournament |
| `GET /tournaments/:id/participants` | any | joined students |
| `GET /tournaments/:id/leaderboard` | any | standings, plus `winners` once completed |
| `GET /tournaments/:id/matches` | any | every game: players, result, how it ended |
| `POST /tournaments` | coach | create (starts as `draft`) |
| `PATCH /tournaments/:id` | coach | edit name / start / time control |
| `PATCH /tournaments/:id/status` | coach | `draft → open → ongoing → completed`, forward only |
| `DELETE /tournaments/:id` | coach | delete a draft (204) |
| `POST /tournaments/:id/join` | student | join an open tournament |
| `POST` / `GET` / `DELETE /tournaments/:id/queue` | student | enter / check / leave matchmaking |
| `GET /me/schedule` | student | joined, unfinished tournaments + active game |
| `GET /me/matches` | student | finished games |
| `GET /health` | public | liveness |

### Socket.IO (namespace `/game`)

The browser connects directly to the API origin. The handshake is authenticated
with the same httpOnly cookie, and an invalid one is rejected before any handler
runs. Client events use acknowledgements shaped `{ ok: true, data } | { ok: false, error }`.

| Event | Direction | Payload | Notes |
| ----- | --------- | ------- | ----- |
| `match:join` | C → S | `{ matchId }` | ack = full snapshot (FEN, PGN, moves, clocks). Also used to reconnect. |
| `match:move` | C → S | `{ matchId, from, to, promotion?, ply }` | `ply` makes retries and out-of-order moves harmless |
| `match:resign` | C → S | `{ matchId }` | |
| `match:leave` | C → S | `{ matchId }` | |
| `tournament:watch` / `tournament:unwatch` | C → S | `{ tournamentId }` | same visibility rule as REST |
| `match:found` | S → C | `{ matchId, tournamentId, white, black, ... }` | to both players, every open tab |
| `match:moved` | S → C | `{ san, fen, pgn, clock, turn, ply, ... }` | to the match room |
| `match:ended` | S → C | `{ result, termination, winnerId, pgn, ... }` | to the match room |
| `tournament:updated` | S → C | `{ tournamentId, status? }` | a nudge: clients refetch over REST |

### Error codes

`VALIDATION_ERROR`, `NOT_AUTHENTICATED`, `INVALID_CREDENTIALS`, `FORBIDDEN_ROLE`,
`TOURNAMENT_NOT_FOUND`, `INVALID_STATUS_TRANSITION`, `NOT_ENOUGH_PLAYERS`,
`MATCHES_IN_PROGRESS`, `STATUS_CHANGED_CONCURRENTLY`, `TIME_CONTROL_LOCKED`,
`TOURNAMENT_NOT_OPEN`, `TOURNAMENT_NOT_ONGOING`, `ALREADY_JOINED`,
`ALREADY_IN_MATCH`, `NOT_A_PARTICIPANT`, `NOT_A_PLAYER`, `NOT_YOUR_TURN`,
`ILLEGAL_MOVE`, `STALE_PLY`, `GAME_OVER`, `MATCH_NOT_FOUND`.

## Design decisions and trade-offs

- **The server owns the game and the clock.** The browser sends only an intent
  (`from`, `to`, `ply`). The server validates turn, legality and ordering with
  chess.js, charges thinking time from its own clock, and one server timer ends a
  game on time even if both tabs are closed. Clients just render the last snapshot.
  A reconnect is one `match:join`.
- **No double-booking, enforced by the database.** `player_active_match` has the
  user id as its primary key. A player is locked in the same transaction that
  creates the match and released in the one that ends it, so even racing pairing
  attempts cannot put a player in two games.
- **Matchmaking** is a FIFO in-memory queue per tournament. It prefers opponents a
  player has not met yet (a rematch is allowed after 15 s so nobody waits forever),
  balances colours, and never blocks the head of the queue. The match is created in
  one transaction that holds `FOR SHARE` on the tournament row.
- **Tournament status** is a forward-only state machine with optimistic
  concurrency (`WHERE status = from`). Completing locks the row `FOR UPDATE`,
  refuses while a game is live, and stores the winner in the same transaction.
- **Scores are integers.** Points are kept in half-points (win 2, draw 1) and
  Sonneborn-Berger in quarter-points, so sums and tie checks are exact. Fractions
  appear only when displayed. Standings are recomputed from game results on read.
- **Tiebreaks**: points, then Sonneborn-Berger, then wins, then head-to-head
  (only for an exact two-way tie). Players still level share a rank (1, 2, 2, 4).
  A shared first place has no single `winner_id`; the leaderboard lists co-winners.
- **Auth**: JWT in an httpOnly, SameSite=Lax cookie (JavaScript cannot read it,
  and cross-site requests do not carry it). A global guard protects everything
  unless a route opts out with `@Public()`. Frontend role redirects are only UX;
  the API guards are the enforcement. Login compares against a dummy hash for
  unknown emails so response time does not reveal which emails exist.
- **Dates** are stored as UTC and shown as `DD/MM/YYYY, HH:mm IST`.

## Testing

`npm test` runs ~130 fast unit tests. The rules live in pure functions or classes
with injected time, so they need no database or sockets: scoring and tiebreaks,
join rules, tournament status transitions, time-control parsing, pairing, queue
rules, clocks, and move/turn/ply validation and every game ending in the game
engine. `npm run test:e2e -w apps/api` checks the global guards and the response
envelope over HTTP. Socket wiring is thin glue over the tested engine and was
checked manually with two browsers.

## Known limitations

- **Single API instance.** The matchmaking queue and live games are in memory. The
  database stays correct, and an unfinished game is rebuilt from the `moves` table
  after a restart, but running several instances would need a shared queue and
  the Socket.IO Redis adapter.
- A join does not push to the coach's page, which refreshes on the next update.
- The Docker demo seeds on every start (passwords are reset to the seed values) and
  uses a demo `JWT_SECRET` unless you set one in `.env`.
- No draw offers, spectators or move-list navigation yet.

## What I would do next

Draw offers; spectator mode for the coach; standings-based pairing; round-robin
completion that ends the tournament automatically; Redis for the queue and the
Socket.IO adapter; Playwright end-to-end tests.

## Repository layout

```
apps/api   NestJS: auth, tournaments, matchmaking, game (engine + gateway), db (schema, migrations, seed)
apps/web   Next.js: coach and student areas, live board
docker-compose.yml   db + api + web
```
