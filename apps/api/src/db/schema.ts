import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/** Standard chess starting position. */
export const START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------- enums

export const userRole = pgEnum('user_role', ['coach', 'student']);

export const tournamentStatus = pgEnum('tournament_status', [
  'draft', // only the coach sees it
  'open', // students can join
  'ongoing', // matchmaking is running
  'completed', // no new games, winner declared
]);

export const matchStatus = pgEnum('match_status', [
  'active',
  'completed',
  'aborted', // ended before a result counted (e.g. first move never made)
]);

/** PGN result notation. */
export const matchResult = pgEnum('match_result', ['1-0', '0-1', '1/2-1/2']);

export const matchTermination = pgEnum('match_termination', [
  'checkmate',
  'resignation',
  'timeout',
  'stalemate',
  'insufficient_material',
  'threefold_repetition',
  'fifty_move_rule',
  'draw_agreement',
]);

// ---------------------------------------------------------------- tables

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(), // stored lowercased
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  role: userRole('role').notNull(),
  createdAt: createdAt(),
});

export const tournaments = pgTable(
  'tournaments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 120 }).notNull(),
    // "5+3" is stored as 300 / 3: the clock logic needs numbers, the string is just display.
    initialSeconds: integer('initial_seconds').notNull(),
    incrementSeconds: integer('increment_seconds').notNull().default(0),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    status: tournamentStatus('status').notNull().default('draft'),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    winnerId: uuid('winner_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('tournaments_status_idx').on(t.status),
    check('tournaments_initial_seconds_positive', sql`${t.initialSeconds} > 0`),
    check(
      'tournaments_increment_non_negative',
      sql`${t.incrementSeconds} >= 0`,
    ),
  ],
);

/** Many-to-many: which students joined which tournament. The composite PK makes a double join impossible. */
export const tournamentParticipants = pgTable(
  'tournament_participants',
  {
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.tournamentId, t.userId] }),
    index('tournament_participants_user_idx').on(t.userId),
  ],
);

export const matches = pgTable(
  'matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    whiteId: uuid('white_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    blackId: uuid('black_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: matchStatus('status').notNull().default('active'),
    result: matchResult('result'), // null while active / aborted
    termination: matchTermination('termination'),
    fen: text('fen').notNull().default(START_FEN), // current position, for instant restore
    pgn: text('pgn').notNull().default(''), // full game record
    // Clock snapshot. Time control is copied from the tournament so editing the
    // tournament later can never change a game that already started.
    incrementMs: integer('increment_ms').notNull(),
    whiteMs: integer('white_ms').notNull(),
    blackMs: integer('black_ms').notNull(),
    turnStartedAt: timestamp('turn_started_at', { withTimezone: true }), // when the side to move started thinking
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => [
    index('matches_tournament_idx').on(t.tournamentId),
    index('matches_white_idx').on(t.whiteId),
    index('matches_black_idx').on(t.blackId),
    index('matches_status_idx').on(t.status),
    check('matches_different_players', sql`${t.whiteId} <> ${t.blackId}`),
  ],
);

/** One row per half-move (ply). An event log: replaying it rebuilds any game (reconnect, review). */
export const moves = pgTable(
  'moves',
  {
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    ply: integer('ply').notNull(), // 1 = white's first move, 2 = black's first move, ...
    san: varchar('san', { length: 10 }).notNull(), // e.g. "Nf3", "exd8=Q+"
    from: varchar('from', { length: 2 }).notNull(),
    to: varchar('to', { length: 2 }).notNull(),
    promotion: varchar('promotion', { length: 1 }),
    fenAfter: text('fen_after').notNull(),
    whiteMs: integer('white_ms').notNull(), // clocks right after this move
    blackMs: integer('black_ms').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.ply] })],
);

/**
 * The double-booking guard.
 * A row exists while a player is in an active match. Because user_id is the PRIMARY KEY,
 * Postgres itself refuses a second active match for the same player, whatever colour,
 * even if two pairing attempts race. Rows are inserted in the same transaction that
 * creates the match and deleted in the transaction that finishes it.
 */
export const playerActiveMatch = pgTable(
  'player_active_match',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [index('player_active_match_match_idx').on(t.matchId)],
);

// ---------------------------------------------------------------- relations (for db.query.* with joins)

export const usersRelations = relations(users, ({ many }) => ({
  participations: many(tournamentParticipants),
  gamesAsWhite: many(matches, { relationName: 'white' }),
  gamesAsBlack: many(matches, { relationName: 'black' }),
}));

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [tournaments.createdById],
    references: [users.id],
  }),
  winner: one(users, {
    fields: [tournaments.winnerId],
    references: [users.id],
  }),
  participants: many(tournamentParticipants),
  matches: many(matches),
}));

export const tournamentParticipantsRelations = relations(
  tournamentParticipants,
  ({ one }) => ({
    tournament: one(tournaments, {
      fields: [tournamentParticipants.tournamentId],
      references: [tournaments.id],
    }),
    user: one(users, {
      fields: [tournamentParticipants.userId],
      references: [users.id],
    }),
  }),
);

export const matchesRelations = relations(matches, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [matches.tournamentId],
    references: [tournaments.id],
  }),
  white: one(users, {
    fields: [matches.whiteId],
    references: [users.id],
    relationName: 'white',
  }),
  black: one(users, {
    fields: [matches.blackId],
    references: [users.id],
    relationName: 'black',
  }),
  moves: many(moves),
}));

export const movesRelations = relations(moves, ({ one }) => ({
  match: one(matches, { fields: [moves.matchId], references: [matches.id] }),
}));

// ---------------------------------------------------------------- row types

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserRole = (typeof userRole.enumValues)[number];
export type Tournament = typeof tournaments.$inferSelect;
export type NewTournament = typeof tournaments.$inferInsert;
export type TournamentStatus = (typeof tournamentStatus.enumValues)[number];
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type MatchStatus = (typeof matchStatus.enumValues)[number];
export type MatchResult = (typeof matchResult.enumValues)[number];
export type MatchTermination = (typeof matchTermination.enumValues)[number];
export type Move = typeof moves.$inferSelect;
