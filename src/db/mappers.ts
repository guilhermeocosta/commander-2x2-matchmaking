/**
 * Pure mapping from database rows to the domain types in src/core. No client and no secrets, so
 * it can be unit-tested without a database.
 */
import type { RoundRecord, Seat, SeatPosition, TableRecord } from "../core/types.ts";
import type { RoundRow, SeatRow, TableRow } from "./schema.ts";

const seatOrder = (a: Seat, b: Seat) => a.team.localeCompare(b.team) || a.position - b.position;

/** Throws on a position other than 1 or 2 (the database check makes that impossible). */
function toSeatPosition(position: number): SeatPosition {
  if (position === 1 || position === 2) return position;
  throw new RangeError(`invalid seat position ${position}`);
}

/** Seats sorted A1, A2, B1, B2. */
export function toSeats(rows: readonly Pick<SeatRow, "eventPlayerId" | "team" | "position">[]) {
  return rows
    .map((s): Seat => ({
      playerId: s.eventPlayerId,
      team: s.team,
      position: toSeatPosition(s.position),
    }))
    .sort(seatOrder);
}

/** A table row and its seats as the core `TableRecord`. `games` is set only when both are. */
export function toTableRecord(
  table: Pick<TableRow, "kind" | "outcome" | "gamesA" | "gamesB">,
  seats: readonly Pick<SeatRow, "eventPlayerId" | "team" | "position">[]
): TableRecord {
  const record: TableRecord = { kind: table.kind, seats: toSeats(seats), outcome: table.outcome };
  if (table.kind === "1v1" && table.gamesA !== null && table.gamesB !== null) {
    record.games = { a: table.gamesA, b: table.gamesB };
  }
  return record;
}

/**
 * Groups rows of one event into `RoundRecord`s, ordered by round number, with tables ordered by
 * table number. Tables and seats of rounds not in `rounds` are ignored.
 */
export function toRoundRecords(
  rounds: readonly Pick<RoundRow, "id" | "number">[],
  tables: readonly Pick<
    TableRow,
    "id" | "roundId" | "number" | "kind" | "outcome" | "gamesA" | "gamesB"
  >[],
  seats: readonly Pick<SeatRow, "tableId" | "eventPlayerId" | "team" | "position">[]
): RoundRecord[] {
  const seatsByTable = new Map<string, (typeof seats)[number][]>();
  for (const seat of seats) {
    const list = seatsByTable.get(seat.tableId) ?? [];
    list.push(seat);
    seatsByTable.set(seat.tableId, list);
  }
  const tablesByRound = new Map<string, (typeof tables)[number][]>();
  for (const table of tables) {
    const list = tablesByRound.get(table.roundId) ?? [];
    list.push(table);
    tablesByRound.set(table.roundId, list);
  }
  return [...rounds]
    .sort((a, b) => a.number - b.number)
    .map((round) => ({
      round: round.number,
      tables: (tablesByRound.get(round.id) ?? [])
        .sort((a, b) => a.number - b.number)
        .map((table) => toTableRecord(table, seatsByTable.get(table.id) ?? [])),
    }));
}

/** Seat rows for a `TableRecord`, to insert alongside its table row. */
export function toSeatRows(tableId: string, roundId: string, record: TableRecord): SeatRow[] {
  return record.seats.map((s) => ({
    tableId,
    roundId,
    eventPlayerId: s.playerId,
    team: s.team,
    position: s.position,
  }));
}
