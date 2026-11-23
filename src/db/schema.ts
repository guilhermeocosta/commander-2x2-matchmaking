/**
 * Drizzle schema for Phase 0. See "Data model" in docs/architecture.md and the field meanings
 * in docs/rules.md and CONTEXT.md. Enum values match the types in src/core/types.ts.
 *
 * This module only declares tables (no client, no secrets), so drizzle-kit can load it.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const eventStatus = pgEnum("event_status", ["open", "running", "finished"]);
export const roundStatus = pgEnum("round_status", [
  "draft",
  "published",
  "running",
  "paused",
  "overtime",
  "closed",
]);
export const tableKind = pgEnum("table_kind", ["2v2", "1v1", "bye"]);
export const team = pgEnum("team", ["A", "B"]);
export const outcome = pgEnum("outcome", ["A", "B", "draw"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** One tournament day. `code` is what players type to join. */
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    status: eventStatus("status").notNull().default("open"),
    rounds: integer("rounds").notNull().default(3),
    roundDurationSec: integer("round_duration_sec")
      .notNull()
      .default(50 * 60),
    /** Seeds the standings' final random tiebreak. */
    seed: integer("seed").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("events_code_format", sql`${t.code} ~ '^[A-Z0-9]{4}$'`),
    check("events_rounds_positive", sql`${t.rounds} >= 1`),
    check("events_round_duration_positive", sql`${t.roundDurationSec} > 0`),
  ]
);

/** A person at one event. No account: a device-token cookie identifies them. */
export const eventPlayers = pgTable(
  "event_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    /** Season player id from leaderboard.json (kebab-case), when matched. */
    rosterId: text("roster_id"),
    /**
     * SHA-256 (hex) of the player's device token. The token itself only lives in the player's
     * cookie, so a leaked row can't be used to act as the player.
     */
    deviceTokenHash: text("device_token_hash").unique(),
    /** First round the player can be paired in (1 unless they joined late). */
    joinedRound: integer("joined_round").notNull().default(1),
    /** Last round they played before dropping; null while active. */
    droppedAfterRound: integer("dropped_after_round"),
    createdAt: createdAt(),
  },
  (t) => [
    // Also serves lookups by event_id (leading column).
    unique("event_players_event_roster_unique").on(t.eventId, t.rosterId),
    check("event_players_joined_round_positive", sql`${t.joinedRound} >= 1`),
    check(
      "event_players_dropped_after_round_valid",
      sql`${t.droppedAfterRound} is null or ${t.droppedAfterRound} >= 0`
    ),
  ]
);

/** One Swiss round. The timer fields are read by every client (see docs/architecture.md). */
export const rounds = pgTable(
  "rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    status: roundStatus("status").notNull().default("draft"),
    /** Seed the pairing was generated from; a re-roll stores a new one. */
    seed: integer("seed").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    elapsedBeforePauseSec: integer("elapsed_before_pause_sec").notNull().default(0),
    durationSec: integer("duration_sec").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("rounds_event_number_unique").on(t.eventId, t.number),
    check("rounds_number_positive", sql`${t.number} >= 1`),
    check("rounds_duration_positive", sql`${t.durationSec} > 0`),
    check("rounds_elapsed_non_negative", sql`${t.elapsedBeforePauseSec} >= 0`),
  ]
);

/** A table of a round: 2v2, the 1v1 match or a bye. */
export const tables = pgTable(
  "tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    /** 1-based, in display order (strongest 2v2 first, then the 1v1, then the bye). */
    number: integer("number").notNull(),
    kind: tableKind("kind").notNull(),
    outcome: outcome("outcome"),
    /** 1v1 only: games won per side. */
    gamesA: smallint("games_a"),
    gamesB: smallint("games_b"),
    /** The seated player who reported; null when unreported or set by the admin. */
    reportedBy: uuid("reported_by").references(() => eventPlayers.id, { onDelete: "set null" }),
    reportedAt: timestamp("reported_at", { withTimezone: true }),
    /** True once the admin has set or changed the result. */
    overridden: boolean("overridden").notNull().default(false),
  },
  (t) => [
    unique("tables_round_number_unique").on(t.roundId, t.number),
    // Target of the composite foreign key from seats, so a seat's round_id always matches.
    unique("tables_id_round_unique").on(t.id, t.roundId),
    check("tables_number_positive", sql`${t.number} >= 1`),
    check(
      "tables_games_valid",
      sql`(${t.gamesA} is null or ${t.gamesA} >= 0) and (${t.gamesB} is null or ${t.gamesB} >= 0)`
    ),
    check(
      "tables_games_only_1v1",
      sql`${t.kind} = '1v1' or (${t.gamesA} is null and ${t.gamesB} is null)`
    ),
  ]
);

/**
 * A player's place at a table. `round_id` is copied from the table so the database can enforce
 * that a player sits at most once per round.
 */
export const seats = pgTable(
  "seats",
  {
    tableId: uuid("table_id").notNull(),
    roundId: uuid("round_id").notNull(),
    // No cascade: a player who has sat at a table can't be deleted on their own (their results
    // count for others). Deleting the whole event still removes both in one statement.
    eventPlayerId: uuid("event_player_id")
      .notNull()
      .references(() => eventPlayers.id),
    team: team("team").notNull(),
    position: smallint("position").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.tableId, t.team, t.position] }),
    foreignKey({
      name: "seats_table_round_fk",
      columns: [t.tableId, t.roundId],
      foreignColumns: [tables.id, tables.roundId],
    }).onDelete("cascade"),
    unique("seats_round_player_unique").on(t.roundId, t.eventPlayerId),
    index("seats_event_player_idx").on(t.eventPlayerId),
    check("seats_position_valid", sql`${t.position} in (1, 2)`),
  ]
);

/** Append-only log of admin and player actions. Never store secrets or tokens in `payload`. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }),
    /** `admin`, `player:<event_player_id>` or `system`. */
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_event_at_idx").on(t.eventId, t.at)]
);

export type EventRow = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type EventPlayerRow = typeof eventPlayers.$inferSelect;
export type RoundRow = typeof rounds.$inferSelect;
export type TableRow = typeof tables.$inferSelect;
export type SeatRow = typeof seats.$inferSelect;
export type AuditRow = typeof auditLog.$inferSelect;
