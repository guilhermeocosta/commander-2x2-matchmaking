import { describe, expect, it } from "vitest";
import { oneVsOneOutcome, playerResults, tableOutcome } from "./results";
import { bye, oneVsOne, twoVsTwo } from "./test-helpers";
import type { RoundRecord } from "./types";

describe("oneVsOneOutcome (MTR)", () => {
  it.each([
    [2, 0, "A"],
    [2, 1, "A"],
    [1, 0, "A"],
    [0, 2, "B"],
    [1, 2, "B"],
    [0, 1, "B"],
    [1, 1, "draw"],
    [0, 0, "draw"],
  ] as const)("%i-%i → %s", (a, b, expected) => {
    expect(oneVsOneOutcome(a, b)).toBe(expected);
  });

  it.each([
    [2, 2],
    [3, 0],
    [-1, 0],
    [1.5, 0],
  ])("rejects %d-%d", (a, b) => {
    expect(() => oneVsOneOutcome(a, b)).toThrow(RangeError);
  });
});

describe("tableOutcome", () => {
  it("derives a 1v1 outcome from games when none is set", () => {
    expect(tableOutcome(oneVsOne("p", "q", { a: 1, b: 2 }))).toBe("B");
  });

  it("prefers an explicit outcome (admin override)", () => {
    expect(tableOutcome(oneVsOne("p", "q", { a: 1, b: 2 }, "draw"))).toBe("draw");
  });

  it("is null while unreported", () => {
    expect(tableOutcome(twoVsTwo(["a", "b"], ["c", "d"], null))).toBeNull();
    expect(tableOutcome(oneVsOne("p", "q", null))).toBeNull();
  });
});

describe("playerResults", () => {
  it("gives both teammates the team's result", () => {
    const res = playerResults([{ round: 1, tables: [twoVsTwo(["a", "b"], ["c", "d"], "A")] }]);
    expect(res.a[0]).toMatchObject({ result: "win", teammates: ["b"], opponents: ["c", "d"] });
    expect(res.b[0]).toMatchObject({ result: "win", teammates: ["a"], opponents: ["c", "d"] });
    expect(res.c[0]).toMatchObject({ result: "loss", teammates: ["d"], opponents: ["a", "b"] });
    expect(res.d[0]).toMatchObject({ result: "loss", teammates: ["c"], opponents: ["a", "b"] });
  });

  it("gives everyone a draw on a drawn table", () => {
    const res = playerResults([{ round: 1, tables: [twoVsTwo(["a", "b"], ["c", "d"], "draw")] }]);
    expect(["a", "b", "c", "d"].map((p) => res[p][0].result)).toEqual([
      "draw",
      "draw",
      "draw",
      "draw",
    ]);
  });

  it.each([
    [{ a: 2, b: 1 }, "win", "loss"],
    [{ a: 1, b: 0 }, "win", "loss"],
    [{ a: 1, b: 1 }, "draw", "draw"],
    [{ a: 0, b: 0 }, "draw", "draw"],
  ] as const)("1v1 games %o → %s / %s", (games, forA, forB) => {
    const res = playerResults([{ round: 1, tables: [oneVsOne("p", "q", games)] }]);
    expect(res.p[0]).toMatchObject({ kind: "1v1", result: forA, teammates: [], opponents: ["q"] });
    expect(res.q[0]).toMatchObject({ kind: "1v1", result: forB, teammates: [], opponents: ["p"] });
  });

  it("records a bye with no opponents", () => {
    const res = playerResults([{ round: 1, tables: [bye("z")] }]);
    expect(res.z).toEqual([{ round: 1, kind: "bye", result: "bye", teammates: [], opponents: [] }]);
  });

  it("skips unreported tables", () => {
    const res = playerResults([{ round: 1, tables: [twoVsTwo(["a", "b"], ["c", "d"], null)] }]);
    expect(res).toEqual({});
  });

  it("orders results by round and has no entry for missed rounds (late join)", () => {
    const rounds: RoundRecord[] = [
      { round: 3, tables: [twoVsTwo(["late", "a"], ["b", "c"], "B")] },
      { round: 1, tables: [twoVsTwo(["a", "b"], ["c", "d"], "A")] },
      { round: 2, tables: [twoVsTwo(["late", "b"], ["c", "d"], "A")] },
    ];
    const res = playerResults(rounds);
    expect(res.late.map((r) => [r.round, r.result])).toEqual([
      [2, "win"],
      [3, "loss"],
    ]);
    expect(res.a.map((r) => r.round)).toEqual([1, 3]);
  });

  it("rejects a player seated twice in a round", () => {
    expect(() =>
      playerResults([{ round: 1, tables: [twoVsTwo(["a", "b"], ["c", "d"], "A"), bye("a")] }])
    ).toThrow(/seated twice/);
  });

  it("rejects tables with the wrong seats", () => {
    const badBye = { ...bye("a"), seats: [] };
    expect(() => playerResults([{ round: 1, tables: [badBye] }])).toThrow(/bye/);

    const lopsided = twoVsTwo(["a", "b"], ["c", "d"], "A");
    lopsided.seats[1] = { playerId: "c", team: "A", position: 2 };
    expect(() => playerResults([{ round: 1, tables: [lopsided] }])).toThrow(/2v2/);
  });
});
