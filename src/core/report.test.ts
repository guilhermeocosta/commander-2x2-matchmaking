import { describe, expect, it } from "vitest";

import {
  canOverride,
  isRoundOpen,
  leftMidGameResult,
  reportPermission,
  resolveResult,
  resultStatus,
  tablesMissingResults,
  type ReportTable,
} from "./report.ts";

describe("resolveResult", () => {
  it("stores a 2v2 outcome without games", () => {
    expect(resolveResult({ kind: "2v2", outcome: "B" })).toEqual({
      outcome: "B",
      gamesA: null,
      gamesB: null,
    });
  });

  it("stores a 1v1 1–1 as a draw and 1–0 as a win, keeping the games", () => {
    expect(resolveResult({ kind: "1v1", gamesA: 1, gamesB: 1 })).toEqual({
      outcome: "draw",
      gamesA: 1,
      gamesB: 1,
    });
    expect(resolveResult({ kind: "1v1", gamesA: 1, gamesB: 0 }).outcome).toBe("A");
    expect(resolveResult({ kind: "1v1", gamesA: 1, gamesB: 2 }).outcome).toBe("B");
    expect(resolveResult({ kind: "1v1", gamesA: 0, gamesB: 0 }).outcome).toBe("draw");
  });

  it("rejects impossible 1v1 games", () => {
    expect(() => resolveResult({ kind: "1v1", gamesA: 2, gamesB: 2 })).toThrow(RangeError);
    expect(() => resolveResult({ kind: "1v1", gamesA: 3, gamesB: 0 })).toThrow(RangeError);
  });
});

describe("leftMidGameResult", () => {
  it("gives the win to the other team and clears games", () => {
    expect(leftMidGameResult("A")).toEqual({ outcome: "B", gamesA: null, gamesB: null });
    expect(leftMidGameResult("B").outcome).toBe("A");
  });
});

describe("round status", () => {
  it("takes player reports only while published and not closed", () => {
    expect(isRoundOpen("draft")).toBe(false);
    expect(isRoundOpen("published")).toBe(true);
    expect(isRoundOpen("running")).toBe(true);
    expect(isRoundOpen("paused")).toBe(true);
    expect(isRoundOpen("overtime")).toBe(true);
    expect(isRoundOpen("closed")).toBe(false);
  });

  it("lets the admin override any round past draft, closed included", () => {
    expect(canOverride("draft")).toBe(false);
    expect(canOverride("running")).toBe(true);
    expect(canOverride("closed")).toBe(true);
  });
});

describe("reportPermission", () => {
  const tables: ReportTable[] = [
    {
      number: 1,
      kind: "2v2",
      seats: [{ playerId: "a" }, { playerId: "b" }, { playerId: "c" }, { playerId: "d" }],
      overridden: false,
    },
    { number: 2, kind: "1v1", seats: [{ playerId: "e" }, { playerId: "f" }], overridden: true },
    { number: 3, kind: "bye", seats: [{ playerId: "g" }], overridden: false },
  ];
  const check = (playerId: string, tableNumber: number, kind: "2v2" | "1v1" = "2v2") =>
    reportPermission({ roundStatus: "running", tables, tableNumber, playerId, kind });

  it("lets a seated player report their own table", () => {
    expect(check("c", 1)).toEqual({ ok: true });
  });

  it("refuses a player who doesn't sit at that table", () => {
    expect(check("e", 1)).toEqual({ ok: false, block: "not-seated" });
    expect(check("a", 9)).toEqual({ ok: false, block: "not-seated" });
    expect(check("nobody", 1)).toEqual({ ok: false, block: "not-seated" });
  });

  it("refuses a closed round, a bye, the wrong form and an admin-set result", () => {
    expect(
      reportPermission({
        roundStatus: "closed",
        tables,
        tableNumber: 1,
        playerId: "a",
        kind: "2v2",
      })
    ).toEqual({ ok: false, block: "round-not-open" });
    expect(check("g", 3)).toEqual({ ok: false, block: "bye" });
    expect(check("a", 1, "1v1")).toEqual({ ok: false, block: "wrong-kind" });
    expect(check("e", 2, "1v1")).toEqual({ ok: false, block: "overridden" });
  });
});

describe("resultStatus and tablesMissingResults", () => {
  it("labels sem resultado, reportado and alterado pelo admin", () => {
    expect(resultStatus({ outcome: null, overridden: false })).toBe("none");
    expect(resultStatus({ outcome: "A", overridden: false })).toBe("reported");
    expect(resultStatus({ outcome: "A", overridden: true })).toBe("overridden");
  });

  it("lists tables without a result, never a bye", () => {
    const missing = tablesMissingResults([
      { number: 1, kind: "2v2", outcome: null },
      { number: 2, kind: "1v1", outcome: "draw" },
      { number: 3, kind: "bye", outcome: null },
    ] as const);
    expect(missing.map((t) => t.number)).toEqual([1]);
  });
});
