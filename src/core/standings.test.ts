import { describe, expect, it } from "vitest";
import { playerResults } from "./results";
import {
  OMW_FLOOR,
  matchWinPct,
  opponentsMatchWinPct,
  points,
  record,
  standings,
} from "./standings";
import { bye, oneVsOne, twoVsTwo } from "./test-helpers";
import type { RoundRecord } from "./types";

const row = (list: ReturnType<typeof standings>, id: string) => {
  const found = list.find((s) => s.playerId === id);
  if (!found) throw new Error(`no standing for ${id}`);
  return found;
};

describe("points, record and match-win %", () => {
  const rounds: RoundRecord[] = [
    { round: 1, tables: [twoVsTwo(["a", "b"], ["c", "d"], "A"), bye("e")] },
    { round: 2, tables: [twoVsTwo(["a", "c"], ["b", "e"], "draw"), bye("d")] },
    { round: 3, tables: [twoVsTwo(["a", "e"], ["b", "d"], "B"), bye("c")] },
  ];
  const res = playerResults(rounds);

  it("scores 3 / 1 / 0", () => {
    expect(points(res.a)).toBe(3 + 1 + 0);
    expect(record(res.a)).toEqual({ wins: 1, draws: 1, losses: 1, matchesPlayed: 3 });
  });

  it("counts a bye as a win (3 points) and as a match played", () => {
    expect(points(res.e)).toBe(3 + 1 + 0);
    expect(record(res.e)).toEqual({ wins: 1, draws: 1, losses: 1, matchesPlayed: 3 });
    expect(matchWinPct(res.e)).toBeCloseTo(4 / 9);
  });

  it("computes match-win % as points ÷ (matches × 3)", () => {
    expect(matchWinPct(res.b)).toBeCloseTo((3 + 1 + 3) / 9);
    expect(matchWinPct([])).toBe(0);
  });

  it("weighs a 1v1 match like a 2v2 match", () => {
    const r = playerResults([{ round: 1, tables: [oneVsOne("p", "q", { a: 2, b: 1 })] }]);
    expect(points(r.p)).toBe(3);
    expect(points(r.q)).toBe(0);
  });
});

describe("opponents' match-win %", () => {
  it("floors each opponent at 33% and averages over every opponent faced", () => {
    const res = playerResults([
      { round: 1, tables: [twoVsTwo(["a", "b"], ["c", "d"], "A")] },
      { round: 2, tables: [twoVsTwo(["a", "c"], ["b", "d"], "draw")] },
    ]);
    // b: 4/6. c, d: 1/6 each, floored to 0.33. a faced c, d, b, d.
    const expected = (OMW_FLOOR + OMW_FLOOR + 4 / 6 + OMW_FLOOR) / 4;
    expect(opponentsMatchWinPct("a", res)).toBeCloseTo(expected, 12);
  });

  it("uses the floor for opponents who lost every match", () => {
    const res = playerResults([{ round: 1, tables: [twoVsTwo(["a", "b"], ["c", "d"], "A")] }]);
    expect(opponentsMatchWinPct("a", res)).toBe(OMW_FLOOR);
    expect(opponentsMatchWinPct("c", res)).toBe(1);
  });

  it("excludes the player's own byes (no opponent) but counts byes in opponents' %", () => {
    const res = playerResults([
      { round: 1, tables: [oneVsOne("x", "y", { a: 2, b: 0 }), bye("z")] },
      { round: 2, tables: [oneVsOne("x", "z", { a: 0, b: 1 }), bye("y")] },
      { round: 3, tables: [oneVsOne("y", "z", { a: 1, b: 1 }), bye("x")] },
    ]);
    // x faced y (loss, bye, draw → 4/9) and z (bye, win, draw → 7/9). x's own bye adds nothing.
    expect(opponentsMatchWinPct("x", res)).toBeCloseTo((4 / 9 + 7 / 9) / 2, 12);
  });

  it("is 0 for a player who only had byes", () => {
    const res = playerResults([{ round: 1, tables: [bye("z")] }]);
    expect(opponentsMatchWinPct("z", res)).toBe(0);
    expect(opponentsMatchWinPct("nobody", res)).toBe(0);
  });

  it("keeps counting a dropped player's past results for their opponents", () => {
    // d drops after round 1; round 2 goes on without them.
    const rounds: RoundRecord[] = [
      { round: 1, tables: [twoVsTwo(["a", "b"], ["c", "d"], "B"), bye("e")] },
      { round: 2, tables: [twoVsTwo(["a", "e"], ["b", "c"], "A")] },
    ];
    const res = playerResults(rounds);
    expect(res.d).toHaveLength(1);
    // a faced c (win, loss → 1/2), d (win → 1), b (loss, loss → 0 → floor), c again.
    expect(opponentsMatchWinPct("a", res)).toBeCloseTo((0.5 + 1 + OMW_FLOOR + 0.5) / 4, 12);

    // d still counts when they are left out of the ranked players.
    const ranked = standings(["a", "b", "c", "e"], rounds, 1);
    expect(ranked.map((s) => s.playerId)).not.toContain("d");
    expect(row(ranked, "a").opponentsMatchWinPct).toBeCloseTo((0.5 + 1 + OMW_FLOOR + 0.5) / 4, 12);
  });
});

describe("standings", () => {
  it("orders by points, then opponents' match-win %", () => {
    const rounds: RoundRecord[] = [
      { round: 1, tables: [twoVsTwo(["a", "b"], ["c", "d"], "A")] },
      { round: 2, tables: [twoVsTwo(["a", "c"], ["b", "d"], "A")] },
    ];
    // a 6 pts; b, c 3 pts; d 0 pts. b faced c, d (win/loss) and a, c; c faced a, b and b, d.
    const list = standings(["d", "c", "b", "a"], rounds, 5);
    expect(list.map((s) => s.rank)).toEqual([1, 2, 3, 4]);
    expect(list[0].playerId).toBe("a");
    expect(list[3].playerId).toBe("d");
    expect(list[1].opponentsMatchWinPct).toBeGreaterThanOrEqual(list[2].opponentsMatchWinPct);
  });

  it("reports points, record and percentages per player", () => {
    const list = standings(["a", "z"], [{ round: 1, tables: [bye("z")] }], 1);
    expect(row(list, "z")).toEqual({
      rank: 1,
      playerId: "z",
      points: 3,
      wins: 1,
      draws: 0,
      losses: 0,
      matchesPlayed: 1,
      matchWinPct: 1,
      opponentsMatchWinPct: 0,
    });
    expect(row(list, "a")).toMatchObject({ rank: 2, points: 0, matchesPlayed: 0 });
  });

  it("counts a late joiner's missed rounds as nothing", () => {
    // `late` joins at round 2 and wins rounds 2 and 3.
    const rounds: RoundRecord[] = [
      { round: 1, tables: [twoVsTwo(["a", "b"], ["c", "d"], "A")] },
      { round: 2, tables: [twoVsTwo(["late", "a"], ["b", "c"], "A"), bye("d")] },
      { round: 3, tables: [twoVsTwo(["late", "d"], ["a", "c"], "A"), bye("b")] },
    ];
    const late = row(standings(["a", "b", "c", "d", "late"], rounds, 3), "late");
    expect(late).toMatchObject({ points: 6, wins: 2, draws: 0, losses: 0, matchesPlayed: 2 });
    expect(late.matchWinPct).toBe(1);
  });

  it("breaks full ties with the seed: same seed, same order", () => {
    // Everyone drew: identical points and OMW, so only the seeded draw decides.
    const rounds: RoundRecord[] = [
      {
        round: 1,
        tables: [
          twoVsTwo(["a", "b"], ["c", "d"], "draw"),
          twoVsTwo(["e", "f"], ["g", "h"], "draw"),
        ],
      },
    ];
    const players = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const order = (ids: string[], seed: number) =>
      standings(ids, rounds, seed).map((s) => s.playerId);

    const first = order(players, 2026);
    expect(order(players, 2026)).toEqual(first);
    expect(order(players.slice().reverse(), 2026)).toEqual(first);

    const orders = new Set(Array.from({ length: 10 }, (_, seed) => order(players, seed).join()));
    expect(orders.size).toBeGreaterThan(1);
  });

  it("ignores duplicate player ids", () => {
    expect(standings(["a", "a"], [], 1)).toHaveLength(1);
  });
});
