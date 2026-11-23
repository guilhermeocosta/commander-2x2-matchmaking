import { describe, expect, it } from "vitest";

import { pairingHistory } from "../core/pairing.ts";
import { toRoundRecords, toSeatRows, toTableRecord } from "./mappers.ts";

const seat = (tableId: string, eventPlayerId: string, team: "A" | "B", position: number) => ({
  tableId,
  eventPlayerId,
  team,
  position,
});

describe("toTableRecord", () => {
  it("sorts seats A1, A2, B1, B2 and leaves games off a 2v2 table", () => {
    const record = toTableRecord({ kind: "2v2", outcome: "B", gamesA: null, gamesB: null }, [
      seat("t", "p4", "B", 2),
      seat("t", "p1", "A", 1),
      seat("t", "p3", "B", 1),
      seat("t", "p2", "A", 2),
    ]);
    expect(record).toEqual({
      kind: "2v2",
      outcome: "B",
      seats: [
        { playerId: "p1", team: "A", position: 1 },
        { playerId: "p2", team: "A", position: 2 },
        { playerId: "p3", team: "B", position: 1 },
        { playerId: "p4", team: "B", position: 2 },
      ],
    });
  });

  it("sets games on a 1v1 table only when both sides are reported", () => {
    const seats = [seat("t", "p1", "A", 1), seat("t", "p2", "B", 1)];
    expect(
      toTableRecord({ kind: "1v1", outcome: null, gamesA: 2, gamesB: 1 }, seats).games
    ).toEqual({ a: 2, b: 1 });
    expect(
      toTableRecord({ kind: "1v1", outcome: null, gamesA: 2, gamesB: null }, seats)
    ).not.toHaveProperty("games");
  });

  it("rejects an invalid seat position", () => {
    expect(() =>
      toTableRecord({ kind: "bye", outcome: null, gamesA: null, gamesB: null }, [
        seat("t", "p1", "A", 3),
      ])
    ).toThrow(RangeError);
  });
});

describe("toRoundRecords", () => {
  it("groups tables and seats by round in number order and feeds pairingHistory", () => {
    const rounds = [
      { id: "r2", number: 2 },
      { id: "r1", number: 1 },
    ];
    const tables = [
      {
        id: "t2",
        roundId: "r1",
        number: 2,
        kind: "bye" as const,
        outcome: null,
        gamesA: null,
        gamesB: null,
      },
      {
        id: "t1",
        roundId: "r1",
        number: 1,
        kind: "2v2" as const,
        outcome: "A" as const,
        gamesA: null,
        gamesB: null,
      },
      {
        id: "t3",
        roundId: "r2",
        number: 1,
        kind: "1v1" as const,
        outcome: null,
        gamesA: 2,
        gamesB: 0,
      },
      {
        id: "tx",
        roundId: "other",
        number: 1,
        kind: "bye" as const,
        outcome: null,
        gamesA: null,
        gamesB: null,
      },
    ];
    const seats = [
      seat("t1", "p1", "A", 1),
      seat("t1", "p2", "A", 2),
      seat("t1", "p3", "B", 1),
      seat("t1", "p4", "B", 2),
      seat("t2", "p5", "A", 1),
      seat("t3", "p1", "A", 1),
      seat("t3", "p5", "B", 1),
    ];
    const records = toRoundRecords(rounds, tables, seats);
    expect(records.map((r) => r.round)).toEqual([1, 2]);
    expect(records[0].tables.map((t) => t.kind)).toEqual(["2v2", "bye"]);
    expect(records[1].tables[0].games).toEqual({ a: 2, b: 0 });

    const history = pairingHistory(records);
    expect(history.byes).toEqual(["p5"]);
    expect(history.oneVsOnes).toEqual(["p1", "p5"]);
    expect(history.teammates).toEqual([
      ["p1", "p2"],
      ["p3", "p4"],
    ]);
  });
});

describe("toSeatRows", () => {
  it("round-trips through toTableRecord", () => {
    const record = toTableRecord({ kind: "1v1", outcome: "A", gamesA: null, gamesB: null }, [
      seat("t", "p1", "A", 1),
      seat("t", "p2", "B", 1),
    ]);
    const rows = toSeatRows("t", "r", record);
    expect(rows).toEqual([
      { tableId: "t", roundId: "r", eventPlayerId: "p1", team: "A", position: 1 },
      { tableId: "t", roundId: "r", eventPlayerId: "p2", team: "B", position: 1 },
    ]);
    expect(toTableRecord({ kind: "1v1", outcome: "A", gamesA: null, gamesB: null }, rows)).toEqual(
      record
    );
  });
});
