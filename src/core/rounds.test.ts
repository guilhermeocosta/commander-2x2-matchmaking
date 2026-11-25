import { describe, expect, it } from "vitest";

import {
  activePlayerIds,
  canFinishEvent,
  nextRoundGate,
  planRound,
  playsRound,
  roundWarnings,
  seatsMatchPlayers,
  swapPlayers,
  type RoundPlayer,
} from "./rounds";
import { bye, oneVsOne, twoVsTwo } from "./test-helpers";
import type { RoundRecord, TableRecord } from "./types";

const players = (n: number): RoundPlayer[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${String(i + 1).padStart(2, "0")}`,
    joinedRound: 1,
    droppedAfterRound: null,
  }));

const seatedIds = (tables: readonly TableRecord[]) =>
  tables.flatMap((t) => t.seats.map((s) => s.playerId));

const kinds = (tables: readonly TableRecord[]) => tables.map((t) => t.kind);

describe("playsRound", () => {
  it("covers late joins and drops", () => {
    const late = { id: "x", joinedRound: 2, droppedAfterRound: null };
    const dropped = { id: "y", joinedRound: 1, droppedAfterRound: 1 };
    const droppedBefore = { id: "z", joinedRound: 1, droppedAfterRound: 0 };
    expect([1, 2, 3].map((r) => playsRound(late, r))).toEqual([false, true, true]);
    expect([1, 2, 3].map((r) => playsRound(dropped, r))).toEqual([true, false, false]);
    expect(playsRound(droppedBefore, 1)).toBe(false);
    expect(activePlayerIds([late, dropped, droppedBefore], 2)).toEqual(["x"]);
  });
});

describe("nextRoundGate", () => {
  const base = { eventStatus: "open" as const, totalRounds: 3, latest: null, activeForNext: 13 };

  it("allows round 1 from 4 active players", () => {
    expect(nextRoundGate(base)).toEqual({ ok: true, round: 1 });
    expect(nextRoundGate({ ...base, activeForNext: 4 })).toEqual({ ok: true, round: 1 });
    expect(nextRoundGate({ ...base, activeForNext: 3 })).toMatchObject({
      ok: false,
      round: 1,
      block: { kind: "too-few-players", active: 3, min: 4 },
    });
  });

  it("waits for the previous round to close", () => {
    for (const status of ["published", "running", "paused", "overtime"] as const) {
      expect(
        nextRoundGate({ ...base, eventStatus: "running", latest: { number: 1, status } })
      ).toMatchObject({ ok: false, round: 2, block: { kind: "previous-not-closed", round: 1 } });
    }
    expect(
      nextRoundGate({ ...base, eventStatus: "running", latest: { number: 1, status: "closed" } })
    ).toEqual({ ok: true, round: 2 });
  });

  it("points at a pending draft instead", () => {
    expect(nextRoundGate({ ...base, latest: { number: 1, status: "draft" } })).toMatchObject({
      ok: false,
      round: 1,
      block: { kind: "draft-pending", round: 1 },
    });
  });

  it("stops after the last round and for a finished event", () => {
    const latest = { number: 3, status: "closed" as const };
    expect(nextRoundGate({ ...base, eventStatus: "running", latest })).toMatchObject({
      ok: false,
      block: { kind: "all-rounds-generated" },
    });
    expect(nextRoundGate({ ...base, eventStatus: "finished" })).toMatchObject({
      ok: false,
      block: { kind: "event-finished" },
    });
  });
});

describe("canFinishEvent", () => {
  it("needs the last round closed", () => {
    const running = { eventStatus: "running" as const, totalRounds: 3 };
    expect(canFinishEvent({ ...running, latest: { number: 3, status: "closed" } })).toBe(true);
    expect(canFinishEvent({ ...running, latest: { number: 3, status: "running" } })).toBe(false);
    expect(canFinishEvent({ ...running, latest: { number: 2, status: "closed" } })).toBe(false);
    expect(canFinishEvent({ ...running, latest: null })).toBe(false);
    expect(
      canFinishEvent({
        ...running,
        eventStatus: "finished",
        latest: { number: 3, status: "closed" },
      })
    ).toBe(false);
  });
});

describe("planRound", () => {
  const input = { pastRounds: [], round: 1, tiebreakSeed: 7, seed: 12345 };

  it("seats 11 players at two 2v2 tables, a 1v1 and a bye", () => {
    const { tables, warnings } = planRound({ ...input, players: players(11) });
    expect(kinds(tables)).toEqual(["2v2", "2v2", "1v1", "bye"]);
    expect(new Set(seatedIds(tables)).size).toBe(11);
    expect(warnings).toEqual([]);
  });

  it("seats 13 players at three 2v2 tables and a bye (13 mod 4 = 1)", () => {
    const { tables } = planRound({ ...input, players: players(13) });
    expect(kinds(tables)).toEqual(["2v2", "2v2", "2v2", "bye"]);
    expect(new Set(seatedIds(tables)).size).toBe(13);
  });

  it("reproduces the same seating from the same seed", () => {
    const a = planRound({ ...input, players: players(13) });
    const b = planRound({ ...input, players: players(13).reverse() });
    expect(b.tables).toEqual(a.tables);
  });

  it("re-rolls to a different seating with a new seed", () => {
    const a = planRound({ ...input, players: players(13) });
    const b = planRound({ ...input, players: players(13), seed: 54321 });
    expect(seatedIds(b.tables)).not.toEqual(seatedIds(a.tables));
  });

  it("leaves out dropped and not-yet-joined players", () => {
    const list = players(9);
    list[0] = { ...list[0], droppedAfterRound: 0 };
    list[1] = { ...list[1], joinedRound: 2 };
    const { tables } = planRound({ ...input, players: list });
    expect(kinds(tables)).toEqual(["2v2", "1v1", "bye"]);
    expect(seatedIds(tables)).not.toContain("p01");
    expect(seatedIds(tables)).not.toContain("p02");
  });

  it("throws below 4 active players", () => {
    expect(() => planRound({ ...input, players: players(3) })).toThrow(RangeError);
  });

  it("uses points and history from past rounds", () => {
    const past: RoundRecord[] = [
      { round: 1, tables: [twoVsTwo(["p01", "p02"], ["p03", "p04"], "A"), bye("p05")] },
    ];
    const { tables, points } = planRound({
      ...input,
      players: players(5),
      pastRounds: past,
      round: 2,
    });
    expect(points.get("p01")).toBe(3);
    expect(points.get("p03")).toBe(0);
    // No second bye for p05.
    expect(tables.find((t) => t.kind === "bye")?.seats[0].playerId).not.toBe("p05");
  });
});

describe("swapPlayers", () => {
  const round: TableRecord[] = [
    twoVsTwo(["a", "b"], ["c", "d"], null),
    oneVsOne("e", "f", null),
    bye("g"),
  ];

  it("swaps two seats and nothing else", () => {
    const swapped = swapPlayers(round, "a", "c");
    expect(swapped[0].seats.map((s) => [s.playerId, s.team, s.position])).toEqual([
      ["c", "A", 1],
      ["a", "B", 1],
      ["b", "A", 2],
      ["d", "B", 2],
    ]);
    expect(swapped.slice(1)).toEqual(round.slice(1));
    expect(round[0].seats[0].playerId).toBe("a");
  });

  it("swaps across the 1v1 and the bye", () => {
    const swapped = swapPlayers(round, "g", "b");
    expect(kinds(swapped)).toEqual(kinds(round));
    expect(swapped[2].seats[0].playerId).toBe("b");
    expect(swapped[0].seats.map((s) => s.playerId)).toContain("g");
    expect(swapPlayers(round, "e", "g")[1].seats.map((s) => s.playerId)).toEqual(["g", "f"]);
  });

  it("rejects a player who isn't seated or the same player twice", () => {
    expect(() => swapPlayers(round, "a", "a")).toThrow();
    expect(() => swapPlayers(round, "a", "zz")).toThrow();
  });
});

describe("roundWarnings", () => {
  const past: RoundRecord[] = [
    {
      round: 1,
      tables: [twoVsTwo(["a", "b"], ["c", "d"], "A"), oneVsOne("e", "f", null, "A"), bye("g")],
    },
  ];

  it("updates after a swap", () => {
    const points = new Map([
      ["a", 3],
      ["b", 3],
      ["c", 0],
      ["d", 0],
      ["e", 3],
      ["f", 0],
      ["g", 3],
    ]);
    const tables: TableRecord[] = [
      twoVsTwo(["a", "e"], ["b", "g"], null),
      oneVsOne("c", "d", null),
      bye("f"),
    ];
    expect(roundWarnings(tables, past, points)).toEqual([]);
    const swapped = swapPlayers(tables, "e", "b");
    expect(roundWarnings(swapped, past, points)).toEqual([
      { kind: "repeated-teammate", playerIds: ["a", "b"] },
    ]);
    // Moving the 1v1 player of round 1 back to the 1v1 table.
    expect(roundWarnings(swapPlayers(tables, "c", "f"), past, points)).toEqual([
      { kind: "second-1v1", playerIds: ["f"] },
    ]);
  });

  it("flags a 2-0 teammate with a 0-2 teammate", () => {
    const points = new Map([
      ["w", 6],
      ["x", 0],
      ["y", 3],
      ["z", 3],
    ]);
    expect(roundWarnings([twoVsTwo(["w", "x"], ["y", "z"], null)], [], points)).toEqual([
      { kind: "extreme-teammates", playerIds: ["w", "x"] },
    ]);
  });
});

describe("seatsMatchPlayers", () => {
  const tables = [twoVsTwo(["a", "b"], ["c", "d"], null), bye("e")];
  it("is false after a drop or a join", () => {
    expect(seatsMatchPlayers(tables, ["e", "d", "c", "b", "a"])).toBe(true);
    expect(seatsMatchPlayers(tables, ["a", "b", "c", "d"])).toBe(false);
    expect(seatsMatchPlayers(tables, ["a", "b", "c", "d", "e", "f"])).toBe(false);
    expect(seatsMatchPlayers(tables, ["a", "b", "c", "d", "f"])).toBe(false);
  });
});
