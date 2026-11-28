import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import {
  applyEventToLeaderboard,
  decklistsToCollect,
  eventResults,
  formatLeaderboard,
  kebabId,
  type EventResult,
  type ExportPlayer,
  type Leaderboard,
} from "./export.ts";
import { bye, oneVsOne, twoVsTwo } from "./test-helpers.ts";
import type { RoundRecord } from "./types.ts";

function input(): Leaderboard {
  return {
    updatedAt: "2026-10-18",
    year: 2026,
    players: [
      {
        id: "arthur",
        name: "Arthur Castro",
        avatar: null,
        stats: { eventsAttended: 5, wins: 13, draws: 0, losses: 2 },
      },
      {
        id: "jose-coutinho",
        name: "José Coutinho",
        avatar: "https://example.com/jose.png",
        stats: { eventsAttended: 2, wins: 3, draws: 1, losses: 2 },
        tiebreakRoll: 4,
      },
      {
        id: "ana-lima",
        name: "Ana Lima",
        avatar: null,
        stats: { eventsAttended: 1, wins: 0, draws: 0, losses: 3 },
      },
    ],
  };
}

const line = (
  rosterId: string | null,
  name: string,
  wins: number,
  draws: number,
  losses: number
): EventResult => ({ rosterId, name, wins, draws, losses });

describe("applyEventToLeaderboard", () => {
  it("adds attendance and W/D/L to an existing player, keeping tiebreakRoll and order", () => {
    const { leaderboard, newPlayers } = applyEventToLeaderboard(
      input(),
      [line("jose-coutinho", "Zé", 2, 1, 0)],
      "2026-12-12"
    );
    expect(newPlayers).toEqual([]);
    expect(leaderboard.updatedAt).toBe("2026-12-12");
    expect(leaderboard.year).toBe(2026);
    expect(leaderboard.players.map((p) => p.id)).toEqual(["arthur", "jose-coutinho", "ana-lima"]);
    expect(leaderboard.players[1]).toEqual({
      id: "jose-coutinho",
      name: "José Coutinho", // the site's name wins over the display name
      avatar: "https://example.com/jose.png",
      stats: { eventsAttended: 3, wins: 5, draws: 2, losses: 2 },
      tiebreakRoll: 4,
    });
  });

  it("appends a new player with a kebab-case id and no avatar", () => {
    const { leaderboard, newPlayers } = applyEventToLeaderboard(
      input(),
      [line(null, "Cláudio  Bonfim", 1, 0, 2)],
      "2026-12-12"
    );
    expect(newPlayers).toEqual([
      { id: "claudio-bonfim", name: "Cláudio  Bonfim", reason: "unmatched" },
    ]);
    expect(leaderboard.players.at(-1)).toEqual({
      id: "claudio-bonfim",
      name: "Cláudio  Bonfim",
      avatar: null,
      stats: { eventsAttended: 1, wins: 1, draws: 0, losses: 2 },
    });
  });

  it("makes new ids unique against the file and each other", () => {
    const { newPlayers } = applyEventToLeaderboard(
      input(),
      [
        line(null, "Ana Lima", 0, 0, 3),
        line(null, "Ána Lima", 3, 0, 0),
        line(null, "Arthur", 1, 0, 2),
      ],
      "2026-12-12"
    );
    expect(newPlayers.map((p) => p.id)).toEqual(["ana-lima-2", "ana-lima-3", "arthur-2"]);
  });

  it("treats a roster id missing from the file as a new player keeping that id", () => {
    const { leaderboard, newPlayers } = applyEventToLeaderboard(
      input(),
      [line("pedro-nicola", "Pedro Nicola", 1, 1, 1)],
      "2026-12-12"
    );
    expect(newPlayers).toEqual([
      { id: "pedro-nicola", name: "Pedro Nicola", reason: "missing-roster-id" },
    ]);
    expect(leaderboard.players).toHaveLength(4);
  });

  it("leaves untouched players byte-identical", () => {
    const before = input();
    const { leaderboard } = applyEventToLeaderboard(
      before,
      [line("arthur", "Arthur", 3, 0, 0)],
      "2026-12-12"
    );
    expect(leaderboard.players[1]).toBe(before.players[1]);
    expect(leaderboard.players[2]).toBe(before.players[2]);
    expect(JSON.stringify(leaderboard.players.slice(1))).toBe(
      JSON.stringify(input().players.slice(1))
    );
  });

  it("keeps the input's key order, even when it differs from the schema's", () => {
    const raw = {
      year: 2026,
      updatedAt: "2026-10-18",
      players: [
        {
          stats: { wins: 1, losses: 0, draws: 0, eventsAttended: 1 },
          id: "a",
          tiebreakRoll: 2,
          name: "A",
          avatar: null,
        },
      ],
    };
    const before = JSON.stringify(raw.players[0]);
    const { leaderboard } = applyEventToLeaderboard(raw, [], "2026-12-12");
    expect(Object.keys(leaderboard)).toEqual(["year", "updatedAt", "players"]);
    expect(JSON.stringify(leaderboard.players[0])).toBe(before);
  });

  it("rejects a file that doesn't match the site's schema", () => {
    expect(() => applyEventToLeaderboard({ seasons: [] }, [], "2026-12-12")).toThrow(ZodError);
    const extra = { ...input(), currentSeason: "2026" };
    expect(() => applyEventToLeaderboard(extra, [], "2026-12-12")).toThrow(ZodError);
    expect(() => applyEventToLeaderboard(input(), [], "12/12/2026")).toThrow(ZodError);
  });

  it("rejects two results with the same roster id", () => {
    expect(() =>
      applyEventToLeaderboard(
        input(),
        [line("arthur", "A", 1, 0, 0), line("arthur", "B", 1, 0, 0)],
        "2026-12-12"
      )
    ).toThrow(/roster id/);
  });
});

describe("eventResults", () => {
  const p = (
    id: string,
    rosterId: string | null,
    joinedRound = 1,
    droppedAfterRound: number | null = null
  ): ExportPlayer => ({
    id,
    displayName: id.toUpperCase(),
    rosterId,
    joinedRound,
    droppedAfterRound,
  });

  // Round 1: a+b beat c+d, e has the bye; d drops after it. Round 2: a+c draw b+e, and the late
  // joiners l and f play the 1v1 (l wins). Round 3: a+l beat b+c, e beats f in the 1v1.
  const rounds: RoundRecord[] = [
    { round: 1, tables: [twoVsTwo(["a", "b"], ["c", "d"], "A"), bye("e")] },
    {
      round: 2,
      tables: [twoVsTwo(["a", "c"], ["b", "e"], "draw"), oneVsOne("l", "f", { a: 2, b: 1 })],
    },
    {
      round: 3,
      tables: [twoVsTwo(["a", "l"], ["b", "c"], "A"), oneVsOne("e", "f", { a: 1, b: 0 })],
    },
  ];
  const players = [
    p("a", "arthur"),
    p("b", null),
    p("c", "ana-lima"),
    p("d", null, 1, 1), // dropped after round 1
    p("e", null),
    p("f", null, 2), // late joiner, joined round 2
    p("l", null, 2),
    p("x", null, 1, 0), // left before playing
    p("y", null, 4), // joined after the last round
  ];
  const results = eventResults(players, rounds, 3);
  const byName = new Map(results.map((r) => [r.name, r]));

  it("lists attending players only", () => {
    expect(results.map((r) => r.name)).toEqual(["A", "B", "C", "D", "E", "F", "L"]);
  });

  it("counts a bye as a win", () => {
    expect(byName.get("E")).toMatchObject({ wins: 2, draws: 1, losses: 0 });
  });

  it("gives a late joiner only the rounds they played", () => {
    expect(byName.get("F")).toMatchObject({ wins: 0, draws: 0, losses: 2 });
    expect(byName.get("L")).toMatchObject({ wins: 2, draws: 0, losses: 0 });
  });

  it("keeps a dropped player's results", () => {
    expect(byName.get("D")).toMatchObject({ rosterId: null, wins: 0, draws: 0, losses: 1 });
  });

  it("feeds the leaderboard: +1 attendance for everyone who attended", () => {
    const { leaderboard, newPlayers } = applyEventToLeaderboard(input(), results, "2026-12-12");
    expect(leaderboard.players[0].stats).toEqual({
      eventsAttended: 6,
      wins: 15,
      draws: 1,
      losses: 2,
    });
    expect(leaderboard.players[2].stats).toEqual({
      eventsAttended: 2,
      wins: 0,
      draws: 1,
      losses: 5,
    });
    expect(newPlayers.map((n) => n.id)).toEqual(["b", "d", "e", "f", "l"]);
    expect(leaderboard.players[1]).toEqual(input().players[1]);
  });

  it("lists decklists to collect: 2 or more wins, byes included", () => {
    expect(decklistsToCollect(results).map((r) => [r.name, r.wins])).toEqual([
      ["A", 2],
      ["E", 2],
      ["L", 2],
    ]);
  });
});

describe("kebabId", () => {
  it("strips accents and punctuation", () => {
    expect(kebabId("  João D'Ávila Jr. ")).toBe("joao-d-avila-jr");
    expect(kebabId("Nicholas M.")).toBe("nicholas-m");
  });

  it("falls back when nothing is left", () => {
    expect(kebabId("🐉")).toBe("jogador");
  });

  it("caps the length without a trailing dash", () => {
    const id = kebabId(`${"a".repeat(79)} b`);
    expect(id).toBe("a".repeat(79));
  });
});

describe("formatLeaderboard", () => {
  it("uses 2-space indent and a trailing newline", () => {
    const text = formatLeaderboard(input());
    expect(text.endsWith("}\n")).toBe(true);
    expect(text.split("\n")[1]).toBe('  "updatedAt": "2026-10-18",');
    expect(JSON.parse(text)).toEqual(input());
  });
});
