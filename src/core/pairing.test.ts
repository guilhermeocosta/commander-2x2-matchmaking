import { describe, expect, it } from "vitest";
import {
  assignSpecialSeats,
  compareCost,
  pairRound,
  pairingHistory,
  seatingCost,
  tableLayout,
  type PairingHistory,
  type PairingPlayer,
  type SeatingCost,
} from "./pairing";
import { bye, oneVsOne, twoVsTwo } from "./test-helpers";
import type { TableRecord } from "./types";

const EMPTY: PairingHistory = { teammates: [], opponents: [], byes: [], oneVsOnes: [] };

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

describe("tableLayout", () => {
  it.each([
    [4, { twoVsTwo: 1, oneVsOne: 0, byes: 0 }],
    [5, { twoVsTwo: 1, oneVsOne: 0, byes: 1 }],
    [6, { twoVsTwo: 1, oneVsOne: 1, byes: 0 }],
    [7, { twoVsTwo: 1, oneVsOne: 1, byes: 1 }],
    [8, { twoVsTwo: 2, oneVsOne: 0, byes: 0 }],
    [39, { twoVsTwo: 9, oneVsOne: 1, byes: 1 }],
    [40, { twoVsTwo: 10, oneVsOne: 0, byes: 0 }],
  ])("seats %i players", (n, layout) => {
    expect(tableLayout(n)).toEqual(layout);
  });

  it("seats every player exactly once", () => {
    for (let n = 4; n <= 60; n++) {
      const { twoVsTwo: t, oneVsOne: o, byes: b } = tableLayout(n);
      expect(4 * t + 2 * o + b).toBe(n);
    }
  });

  it("refuses fewer than 4 players or a bad count", () => {
    for (const n of [0, 1, 2, 3]) expect(() => tableLayout(n)).toThrow(RangeError);
    expect(() => tableLayout(-1)).toThrow(RangeError);
    expect(() => tableLayout(4.5)).toThrow(RangeError);
    expect(() => tableLayout(Number.NaN)).toThrow(RangeError);
  });
});

describe("pairingHistory", () => {
  it("lists teammates, opponents, byes and 1v1 players, reported or not", () => {
    const history = pairingHistory([
      { round: 1, tables: [twoVsTwo(["a", "b"], ["c", "d"], null), oneVsOne("e", "f", null)] },
      { round: 2, tables: [twoVsTwo(["a", "c"], ["b", "e"], "A"), bye("d")] },
    ]);
    expect(history.teammates).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["a", "c"],
      ["b", "e"],
    ]);
    expect(history.opponents).toHaveLength(4 + 1 + 4);
    expect(history.opponents).toContainEqual(["e", "f"]);
    expect(history.byes).toEqual(["d"]);
    expect(history.oneVsOnes).toEqual(["e", "f"]);
  });
});

describe("assignSpecialSeats", () => {
  it("leaves everyone at 2v2 tables when n is a multiple of 4", () => {
    expect(assignSpecialSeats(ids(8), EMPTY)).toEqual({ bye: null, oneVsOne: null, rest: ids(8) });
  });

  it("gives the bye to the lowest player, then the 1v1 to the next two", () => {
    const seats = assignSpecialSeats(ids(7), EMPTY);
    expect(seats.bye).toBe("p7");
    expect(seats.oneVsOne).toEqual(["p6", "p5"]);
    expect(seats.rest).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("skips players who already had a bye", () => {
    const history = { ...EMPTY, byes: ["p5", "p4"] };
    expect(assignSpecialSeats(ids(5), history).bye).toBe("p3");
  });

  it("gives a second bye to the lowest player only when everyone had one", () => {
    const history = { ...EMPTY, byes: ids(5) };
    expect(assignSpecialSeats(ids(5), history).bye).toBe("p5");
  });

  it("skips players who already played 1v1 and avoids a rematch", () => {
    const history: PairingHistory = {
      ...EMPTY,
      oneVsOnes: ["p6"],
      opponents: [["p5", "p4"]],
    };
    const seats = assignSpecialSeats(ids(6), history);
    expect(seats.oneVsOne).toEqual(["p5", "p3"]);
  });

  it("accepts a rematch before a second 1v1", () => {
    const history: PairingHistory = {
      ...EMPTY,
      oneVsOnes: ["p1", "p2", "p3", "p4"],
      opponents: [["p5", "p6"]],
    };
    expect(assignSpecialSeats(ids(6), history).oneVsOne).toEqual(["p6", "p5"]);
  });

  it("falls back to players who had a 1v1, from the bottom", () => {
    const history = { ...EMPTY, oneVsOnes: ["p6", "p5", "p4", "p3", "p2"] };
    expect(assignSpecialSeats(ids(6), history).oneVsOne).toEqual(["p1", "p6"]);
  });

  it("keeps the bye and the 1v1 apart", () => {
    const history = { ...EMPTY, oneVsOnes: ["p6"] };
    const seats = assignSpecialSeats(ids(7), history);
    expect(seats.bye).toBe("p7");
    expect(seats.oneVsOne).toEqual(["p5", "p4"]);
    expect(seats.rest).toEqual(["p1", "p2", "p3", "p6"]);
  });
});

/** Players named after their points: `pts([6, 3])` → a6 (6), b3 (3). */
const pts = (values: number[]): PairingPlayer[] =>
  values.map((points, i) => ({ playerId: `${String.fromCharCode(97 + i)}${points}`, points }));

/** Teams of a 2v2 table as sorted id pairs, sorted, for order-free comparison. */
const teamsOf = (table: TableRecord) =>
  (["A", "B"] as const)
    .map((team) =>
      table.seats
        .filter((s) => s.team === team)
        .map((s) => s.playerId)
        .sort()
    )
    .sort();

const playersAt = (table: TableRecord) => table.seats.map((s) => s.playerId).sort();

/** History that marks every player as having played, so pairRound treats it as round 2+. */
const PLAYED: PairingHistory = { ...EMPTY, opponents: [["x", "y"]] };

describe("compareCost", () => {
  it("compares entry by entry, so a higher priority always wins", () => {
    const a: SeatingCost = [0, 1, 0, 0, 0, 0];
    const b: SeatingCost = [0, 0, 99, 99, 99, 99];
    expect(compareCost(a, b)).toBeGreaterThan(0);
    expect(compareCost(b, a)).toBeLessThan(0);
    expect(compareCost(a, a)).toBe(0);
  });
});

describe("pairRound", () => {
  it("seats A1, B1, A2, B2 with the stronger team as A", () => {
    const { tables, warnings } = pairRound({
      players: pts([6, 3, 3, 0]),
      history: PLAYED,
      seed: 1,
    });
    expect(tables).toHaveLength(1);
    const [table] = tables;
    expect(table.kind).toBe("2v2");
    expect(table.outcome).toBeNull();
    expect(table.seats.map((s) => `${s.team}${s.position}`)).toEqual(["A1", "B1", "A2", "B2"]);
    // Closest points together: 6 with 3 and 3 with 0, never 6 with 0.
    expect(teamsOf(table)).toEqual([
      ["a6", "b3"],
      ["c3", "d0"],
    ]);
    expect(table.seats.filter((s) => s.team === "A").map((s) => s.playerId)).toContain("a6");
    expect(warnings).toEqual([]);
  });

  it("groups players by points bracket, top-down", () => {
    const { tables } = pairRound({
      players: pts([6, 6, 3, 3, 3, 3, 0, 0]),
      history: PLAYED,
      seed: 7,
    });
    expect(tables.map((t) => t.seats.map((s) => Number(s.playerId.slice(1))).sort())).toEqual([
      [3, 3, 6, 6],
      [0, 0, 3, 3],
    ]);
    expect(teamsOf(tables[0])[0]).toEqual(["a6", "b6"]);
  });

  it("pairs leftovers down into the next bracket", () => {
    const { tables } = pairRound({
      players: pts([6, 6, 6, 3, 3, 3, 3, 0]),
      history: PLAYED,
      seed: 3,
    });
    expect(tables.map((t) => t.seats.map((s) => Number(s.playerId.slice(1))).sort())).toEqual([
      [3, 6, 6, 6],
      [0, 3, 3, 3],
    ]);
  });

  it("puts the 1v1 table and then the bye after the 2v2 tables", () => {
    const { tables } = pairRound({ players: pts([6, 6, 3, 3, 3, 0, 0]), history: PLAYED, seed: 2 });
    expect(tables.map((t) => t.kind)).toEqual(["2v2", "1v1", "bye"]);
    expect(playersAt(tables[2])).toEqual(["g0"]);
    expect(playersAt(tables[1])).toEqual(["e3", "f0"]);
    expect(tables[1].seats.map((s) => `${s.team}${s.position}`)).toEqual(["A1", "B1"]);
  });

  it("avoids repeated teammates and opponents when points allow", () => {
    const players = pts([3, 3, 3, 3, 3, 3, 3, 3]);
    const [a, b, c, d, e, f, g, h] = players.map((p) => p.playerId);
    const history = pairingHistory([
      { round: 1, tables: [twoVsTwo([a, b], [c, d], "A"), twoVsTwo([e, f], [g, h], "A")] },
    ]);
    for (let seed = 0; seed < 20; seed++) {
      expect(pairRound({ players, history, seed }).warnings).toEqual([]);
    }
  });

  it("keeps points first and warns about the repeated teammate it could not avoid", () => {
    const players = pts([6, 6, 0, 0]);
    const history: PairingHistory = { ...EMPTY, teammates: [["a6", "b6"]] };
    const { tables, warnings } = pairRound({ players, history, seed: 1 });
    expect(teamsOf(tables[0])).toEqual([
      ["a6", "b6"],
      ["c0", "d0"],
    ]);
    expect(warnings).toEqual([{ kind: "repeated-teammate", playerIds: ["a6", "b6"] }]);
  });

  it("never teams a 2-0 player with a 0-2 player when another seating exists", () => {
    // Pure spread would happily seat 6,6,6,0 | 3,3,3,3 or 6,6,6,3 | 3,3,3,0; only the second
    // keeps 6 and 0 apart as teammates.
    const players = pts([6, 6, 6, 3, 3, 3, 3, 0]);
    for (let seed = 0; seed < 20; seed++) {
      const { tables } = pairRound({ players, history: PLAYED, seed });
      const cost = seatingCost(tables, players, PLAYED);
      expect(cost[0]).toBe(0);
    }
  });

  it("warns about a second bye and a second 1v1", () => {
    const players = pts([3, 3, 3, 3, 0, 0, 0]);
    const history: PairingHistory = {
      ...EMPTY,
      byes: players.map((p) => p.playerId),
      oneVsOnes: players.map((p) => p.playerId),
    };
    const { warnings } = pairRound({ players, history, seed: 1 });
    expect(warnings.filter((w) => w.kind === "second-bye")).toHaveLength(1);
    expect(warnings.filter((w) => w.kind === "second-1v1")).toHaveLength(2);
  });

  it("is random in round 1 and the same for the same seed", () => {
    const players = pts(Array(16).fill(0));
    const one = pairRound({ players, history: EMPTY, seed: 42 });
    expect(pairRound({ players, history: EMPTY, seed: 42 })).toEqual(one);
    const seatings = new Set(
      [1, 2, 3, 4, 5].map((seed) =>
        JSON.stringify(pairRound({ players, history: EMPTY, seed }).tables)
      )
    );
    expect(seatings.size).toBeGreaterThan(1);
  });

  it("does not depend on the players' object identity, only on order and values", () => {
    const players = pts([6, 3, 3, 3, 3, 3, 0, 0, 0]);
    const copy = players.map((p) => ({ ...p }));
    expect(pairRound({ players: copy, history: PLAYED, seed: 9 })).toEqual(
      pairRound({ players, history: PLAYED, seed: 9 })
    );
  });

  it("refuses fewer than 4 players and duplicate ids", () => {
    expect(() => pairRound({ players: pts([0, 0, 0]), history: EMPTY, seed: 1 })).toThrow(
      RangeError
    );
    const dup = [...pts([0, 0, 0]), { playerId: "a0", points: 0 }];
    expect(() => pairRound({ players: dup, history: EMPTY, seed: 1 })).toThrow(/twice/);
  });
});
