import { describe, expect, it } from "vitest";
import { assignSpecialSeats, pairingHistory, tableLayout, type PairingHistory } from "./pairing";
import { bye, oneVsOne, twoVsTwo } from "./test-helpers";

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
