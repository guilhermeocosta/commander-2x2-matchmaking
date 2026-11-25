import "server-only";

import { randomInt } from "node:crypto";

import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { generateEventCode } from "../core/event-code.ts";
import type { RoundRecord, TableRecord } from "../core/types.ts";
import { getDb } from "./index.ts";
import { toRoundRecords, toTableRecord } from "./mappers.ts";
import {
  auditLog,
  eventPlayers,
  events,
  rounds,
  seats,
  tables,
  type EventPlayerRow,
  type EventRow,
  type RoundRow,
  type TableRow,
} from "./schema.ts";

/** A positive 31-bit seed, the range `createRng` and Postgres `integer` both accept. */
export function newSeed(): number {
  return randomInt(1, 2 ** 31 - 1);
}

// ---------------------------------------------------------------------------------------------
// Input schemas. Later steps parse browser input with these (or stricter ones) before calling.

export const eventCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{4}$/);

export const newEventSchema = z.object({
  code: eventCodeSchema,
  name: z.string().trim().min(1).max(100),
  date: z.iso.date(),
  rounds: z.int().min(1).max(10).default(3),
  roundDurationSec: z
    .int()
    .min(60)
    .max(4 * 60 * 60)
    .default(50 * 60),
});
export type NewEventInput = z.input<typeof newEventSchema>;

/** SHA-256 (hex) of a device token. */
export const deviceTokenHashSchema = z.string().regex(/^[0-9a-f]{64}$/);

export const newEventPlayerSchema = z.object({
  eventId: z.uuid(),
  displayName: z.string().trim().min(1).max(60),
  rosterId: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(80)
    .nullish(),
  deviceTokenHash: deviceTokenHashSchema.nullish(),
  joinedRound: z.int().min(1).default(1),
});
export type NewEventPlayerInput = z.input<typeof newEventPlayerSchema>;

export const auditEntrySchema = z.object({
  eventId: z.uuid().nullable(),
  actor: z.string().min(1).max(80),
  action: z.string().min(1).max(80),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type AuditEntryInput = z.input<typeof auditEntrySchema>;

// ---------------------------------------------------------------------------------------------
// Events

export async function getEventByCode(code: string): Promise<EventRow | undefined> {
  const parsed = eventCodeSchema.safeParse(code);
  if (!parsed.success) return undefined;
  const [row] = await getDb().select().from(events).where(eq(events.code, parsed.data)).limit(1);
  return row;
}

/** Newest first. */
export async function listEvents(): Promise<EventRow[]> {
  return getDb().select().from(events).orderBy(desc(events.date), desc(events.createdAt));
}

/** Creates an event with a fresh tiebreak seed. Rejects (unique violation) if the code exists. */
export async function createEvent(input: NewEventInput): Promise<EventRow> {
  const values = newEventSchema.parse(input);
  const [row] = await getDb()
    .insert(events)
    .values({ ...values, seed: newSeed() })
    .returning();
  return row;
}

/** True for a Postgres unique violation (SQLSTATE 23505), possibly wrapped by Drizzle. */
export function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error, i = 0; e && i < 3; e = (e as { cause?: unknown }).cause, i++) {
    if ((e as { code?: unknown }).code === "23505") return true;
  }
  return false;
}

const CODE_ATTEMPTS = 10;

/**
 * Creates an event with a fresh random code (see src/core/event-code.ts), retrying on the rare
 * collision with an existing code.
 */
export async function createEventWithNewCode(
  input: Omit<NewEventInput, "code">
): Promise<EventRow> {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const code = generateEventCode(randomInt);
    try {
      return await createEvent({ ...input, code });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new Error("Could not find a free event code");
}

// ---------------------------------------------------------------------------------------------
// Players

/** In join order. */
export async function listEventPlayers(eventId: string): Promise<EventPlayerRow[]> {
  return getDb()
    .select()
    .from(eventPlayers)
    .where(eq(eventPlayers.eventId, eventId))
    .orderBy(asc(eventPlayers.createdAt), asc(eventPlayers.id));
}

export async function addEventPlayer(input: NewEventPlayerInput): Promise<EventPlayerRow> {
  const values = newEventPlayerSchema.parse(input);
  const [row] = await getDb().insert(eventPlayers).values(values).returning();
  return row;
}

/** Looks a player up by the SHA-256 of their device token (never by the token itself). */
export async function getEventPlayerByTokenHash(
  eventId: string,
  deviceTokenHash: string
): Promise<EventPlayerRow | undefined> {
  const [row] = await getDb()
    .select()
    .from(eventPlayers)
    .where(
      and(eq(eventPlayers.eventId, eventId), eq(eventPlayers.deviceTokenHash, deviceTokenHash))
    )
    .limit(1);
  return row;
}

export async function getEventPlayer(
  eventId: string,
  id: string
): Promise<EventPlayerRow | undefined> {
  if (!z.uuid().safeParse(id).success) return undefined;
  const [row] = await getDb()
    .select()
    .from(eventPlayers)
    .where(and(eq(eventPlayers.eventId, eventId), eq(eventPlayers.id, id)))
    .limit(1);
  return row;
}

export const eventPlayerPatchSchema = z
  .object({
    displayName: newEventPlayerSchema.shape.displayName,
    rosterId: newEventPlayerSchema.shape.rosterId,
    deviceTokenHash: newEventPlayerSchema.shape.deviceTokenHash,
    droppedAfterRound: z.int().min(0).nullable(),
  })
  .partial();
export type EventPlayerPatch = z.input<typeof eventPlayerPatchSchema>;

/**
 * Updates one player of an event. Returns undefined when the player isn't in that event.
 * Rejects (unique violation) when the new roster id is already taken in the event.
 */
export async function updateEventPlayer(
  eventId: string,
  id: string,
  patch: EventPlayerPatch
): Promise<EventPlayerRow | undefined> {
  const values = eventPlayerPatchSchema.parse(patch);
  const [row] = await getDb()
    .update(eventPlayers)
    .set(values)
    .where(and(eq(eventPlayers.eventId, eventId), eq(eventPlayers.id, id)))
    .returning();
  return row;
}

/**
 * Replaces a device-token hash with a new one in a single statement, so a token can be used
 * only once (reissue links). Returns the player, or undefined if `oldHash` matches nobody.
 */
export async function swapDeviceTokenHash(
  eventId: string,
  oldHash: string,
  newHash: string
): Promise<EventPlayerRow | undefined> {
  const hash = deviceTokenHashSchema;
  const [row] = await getDb()
    .update(eventPlayers)
    .set({ deviceTokenHash: hash.parse(newHash) })
    .where(
      and(eq(eventPlayers.eventId, eventId), eq(eventPlayers.deviceTokenHash, hash.parse(oldHash)))
    )
    .returning();
  return row;
}

// ---------------------------------------------------------------------------------------------
// Rounds

/** A table as stored, plus its `TableRecord` view for src/core. */
export interface RoundTable {
  row: TableRow;
  record: TableRecord;
}

export interface RoundState {
  round: RoundRow;
  tables: RoundTable[];
}

/** One round with its tables (by number) and seats, or undefined if it doesn't exist. */
export async function getRoundState(
  eventId: string,
  number: number
): Promise<RoundState | undefined> {
  const db = getDb();
  const [round] = await db
    .select()
    .from(rounds)
    .where(and(eq(rounds.eventId, eventId), eq(rounds.number, number)))
    .limit(1);
  if (!round) return undefined;
  const [tableRows, seatRows] = await db.batch([
    db.select().from(tables).where(eq(tables.roundId, round.id)).orderBy(asc(tables.number)),
    db.select().from(seats).where(eq(seats.roundId, round.id)),
  ]);
  return {
    round,
    tables: tableRows.map((row) => ({
      row,
      record: toTableRecord(
        row,
        seatRows.filter((s) => s.tableId === row.id)
      ),
    })),
  };
}

/** The number of the latest generated (paired) round, or 0 before round 1 exists. */
export async function getLatestRoundNumber(eventId: string): Promise<number> {
  const [row] = await getDb()
    .select({ number: rounds.number })
    .from(rounds)
    .where(eq(rounds.eventId, eventId))
    .orderBy(desc(rounds.number))
    .limit(1);
  return row?.number ?? 0;
}

/** The latest round of an event, or undefined before round 1 is generated. */
export async function getLatestRound(eventId: string): Promise<RoundRow | undefined> {
  const [row] = await getDb()
    .select()
    .from(rounds)
    .where(eq(rounds.eventId, eventId))
    .orderBy(desc(rounds.number))
    .limit(1);
  return row;
}

/**
 * Every round of an event as `RoundRecord`s, for `standings` and `pairingHistory`. Pass
 * `throughRound` to stop after that round (e.g. the rounds before the one being paired).
 */
export async function getRoundRecords(
  eventId: string,
  throughRound?: number
): Promise<RoundRecord[]> {
  const db = getDb();
  const [roundRows, tableRows, seatRows] = await db.batch([
    db
      .select({ id: rounds.id, number: rounds.number })
      .from(rounds)
      .where(eq(rounds.eventId, eventId)),
    db
      .select({
        id: tables.id,
        roundId: tables.roundId,
        number: tables.number,
        kind: tables.kind,
        outcome: tables.outcome,
        gamesA: tables.gamesA,
        gamesB: tables.gamesB,
      })
      .from(tables)
      .innerJoin(rounds, eq(tables.roundId, rounds.id))
      .where(eq(rounds.eventId, eventId)),
    db
      .select({
        tableId: seats.tableId,
        eventPlayerId: seats.eventPlayerId,
        team: seats.team,
        position: seats.position,
      })
      .from(seats)
      .innerJoin(rounds, eq(seats.roundId, rounds.id))
      .where(eq(rounds.eventId, eventId)),
  ]);
  const included =
    throughRound === undefined ? roundRows : roundRows.filter((r) => r.number <= throughRound);
  return toRoundRecords(included, tableRows, seatRows);
}

// ---------------------------------------------------------------------------------------------
// Audit log

/** Appends an audit entry. Callers must not put secrets, tokens or personal data in `payload`. */
export async function writeAudit(entry: AuditEntryInput): Promise<void> {
  const values = auditEntrySchema.parse(entry);
  await getDb().insert(auditLog).values(values);
}
