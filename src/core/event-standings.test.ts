import { describe, expect, it } from "vitest";

import { eventStandings, omwLabel, recordLabel, type StandingsPlayer } from "./event-standings.ts";
import { leftMidGameResult, resolveResult } from "./report.ts";
import { bye } from "./test-helpers.ts";
import type { RoundRecord, TableRecord } from "./types.ts";

/** A 2v2 table whose result goes through the same path as a report. */
function table2v2(
  [a1, a2]: [string, string],
  [b1, b2]: [string, string],
  result: ReturnType<typeof resolveResult>
): TableRecord {
  return {
    kind: "2v2",
    seats: [
      { playerId: a1, team: "A", position: 1 },
      { playerId: a2, team: "A", position: 2 },
      { playerId: b1, team: "B", position: 1 },
      { playerId: b2, team: "B", position: 2 },
    ],
    outcome: result.outcome,
  };
}

function table1v1(a: string, b: string, games: { a: number; b: number }): TableRecord {
  const result = resolveResult({ kind: "1v1", gamesA: games.a, gamesB: games.b });
  return {
    kind: "1v1",
    seats: [
      { playerId: a, team: "A", position: 1 },
      { playerId: b, team: "B", position: 1 },
    ],
    outcome: result.outcome,
    games: { a: result.gamesA ?? 0, b: result.gamesB ?? 0 },
  };
}

const win = (outcome: "A" | "B" | "draw") => resolveResult({ kind: "2v2", outcome });

/**
 * A seeded 3-round event: 7 players in round 1 (a 2v2, the 1v1 and a bye), Hana joins late
 * for round 2 (8 players, two 2v2 tables), and round 3 has a "saiu no meio do jogo".
 */
const players: StandingsPlayer[] = [
  { id: "ana", displayName: "Ana", joinedRound: 1, droppedAfterRound: null },
  { id: "bia", displayName: "Bia", joinedRound: 1, droppedAfterRound: null },
  { id: "caio", displayName: "Caio", joinedRound: 1, droppedAfterRound: null },
  { id: "dora", displayName: "Dora", joinedRound: 1, droppedAfterRound: null },
  { id: "eva", displayName: "Eva", joinedRound: 1, droppedAfterRound: null },
  { id: "fabio", displayName: "Fábio", joinedRound: 1, droppedAfterRound: null },
  { id: "gil", displayName: "Gil", joinedRound: 1, droppedAfterRound: null },
  { id: "hana", displayName: "Hana", joinedRound: 2, droppedAfterRound: 3 },
];

const rounds: RoundRecord[] = [
  {
    round: 1,
    tables: [
      table2v2(["ana", "bia"], ["caio", "dora"], win("A")),
      // 1–1 at time: a draw.
      table1v1("eva", "fabio", { a: 1, b: 1 }),
      bye("gil"),
    ],
  },
  {
    round: 2,
    tables: [
      table2v2(["ana", "caio"], ["eva", "gil"], win("B")),
      table2v2(["bia", "hana"], ["dora", "fabio"], win("draw")),
    ],
  },
  {
    round: 3,
    tables: [
      // Hana (team B) left in the middle of the game: team A wins.
      table2v2(["ana", "fabio"], ["gil", "hana"], leftMidGameResult("B")),
      table2v2(["bia", "eva"], ["caio", "dora"], win("B")),
    ],
  },
];

describe("eventStandings: seeded 3-round event", () => {
  /*
   * Hand-computed (MW = match-win %, OMW floors each opponent at 0.33):
   *   Ana  W L W  6 pts  MW 6/9   opp caio dora eva gil gil hana  (3+4+4+6+6)/9 + .33 → /6 = .4809
   *   Bia  W D L  4 pts  MW 4/9   opp caio dora dora fabio caio dora 23/9 / 6           = .4259
   *   Caio L L W  3 pts  MW 3/9   opp ana bia eva gil bia eva 28/9 / 6                  = .5185
   *   Dora L D W  4 pts  MW 4/9   opp ana bia bia hana bia eva 22/9 + .33 → /6          = .4624
   *   Eva  D W L  4 pts  MW 4/9   opp fabio ana caio caio dora 21/9 / 5                 = .4667
   *   Fábio D D W 5 pts  MW 5/9   opp eva bia hana gil hana 14/9 + .66 → /5             = .4431
   *   Gil  bye W L 6 pts MW 6/9   opp ana caio ana fabio 20/9 / 4 (bye has none)        = .5556
   *   Hana D L    1 pt   MW 1/6   opp dora fabio ana fabio 20/9 / 4                      = .5556
   * Ties on points break by OMW: Gil over Ana; Eva over Dora over Bia.
   */
  const result = eventStandings({ players, rounds, seed: 12345, throughRound: 3 });

  it("ranks by points, then opponents' match-win %", () => {
    expect(result?.throughRound).toBe(3);
    expect(result?.rows.map((r) => [r.rank, r.name, r.points, recordLabel(r)])).toEqual([
      [1, "Gil", 6, "2-0-1"],
      [2, "Ana", 6, "2-0-1"],
      [3, "Fábio", 5, "1-2-0"],
      [4, "Eva", 4, "1-1-1"],
      [5, "Dora", 4, "1-1-1"],
      [6, "Bia", 4, "1-1-1"],
      [7, "Caio", 3, "1-0-2"],
      [8, "Hana", 1, "0-1-1"],
    ]);
  });

  it("matches the hand-computed OMW%", () => {
    const omw = Object.fromEntries(result?.rows.map((r) => [r.name, r.omw]) ?? []);
    expect(omw.Gil).toBeCloseTo(20 / 9 / 4, 10);
    expect(omw.Ana).toBeCloseTo((23 / 9 + 0.33) / 6, 10);
    expect(omw.Fábio).toBeCloseTo((14 / 9 + 0.66) / 5, 10);
    expect(omw.Eva).toBeCloseTo(21 / 9 / 5, 10);
    expect(omw.Dora).toBeCloseTo((22 / 9 + 0.33) / 6, 10);
    expect(omw.Bia).toBeCloseTo(23 / 9 / 6, 10);
    expect(omw.Caio).toBeCloseTo(28 / 9 / 6, 10);
    expect(omw.Hana).toBeCloseTo(20 / 9 / 4, 10);
    expect(omwLabel(omw.Gil)).toBe("55,6%");
    expect(omwLabel(omw.Ana)).toBe("48,1%");
  });

  it("keeps a dropped late joiner, flagged, with only the rounds they played", () => {
    const hana = result?.rows.find((r) => r.name === "Hana");
    expect(hana).toMatchObject({ dropped: true, wins: 0, draws: 1, losses: 1 });
    expect(result?.rows.filter((r) => r.dropped)).toHaveLength(1);
  });

  it("only counts rounds up to throughRound and leaves out players not in yet", () => {
    const afterRound1 = eventStandings({ players, rounds, seed: 12345, throughRound: 1 });
    expect(afterRound1?.rows.map((r) => r.name)).not.toContain("Hana");
    expect(afterRound1?.rows).toHaveLength(7);
    const gil = afterRound1?.rows.find((r) => r.name === "Gil");
    expect(gil).toMatchObject({ points: 3, wins: 1, omw: 0 });
    // Eva and Fábio drew the 1v1 1–1.
    expect(afterRound1?.rows.find((r) => r.name === "Eva")).toMatchObject({ points: 1, draws: 1 });
  });

  it("leaves out a player who dropped before their first round", () => {
    const withEarlyDrops: StandingsPlayer[] = [
      ...players,
      { id: "ivo", displayName: "Ivo", joinedRound: 1, droppedAfterRound: 0 },
      { id: "jade", displayName: "Jade", joinedRound: 3, droppedAfterRound: 2 },
    ];
    const names = eventStandings({
      players: withEarlyDrops,
      rounds,
      seed: 12345,
      throughRound: 3,
    })?.rows.map((r) => r.name);
    expect(names).toHaveLength(8);
    expect(names).not.toContain("Ivo");
    expect(names).not.toContain("Jade");
  });

  it("is null before any round closed", () => {
    expect(eventStandings({ players, rounds, seed: 1, throughRound: 0 })).toBeNull();
  });
});

describe("labels", () => {
  it("formats OMW% with a comma and a dash for no opponents", () => {
    expect(omwLabel(0)).toBe("—");
    expect(omwLabel(0.33)).toBe("33,0%");
    expect(omwLabel(1)).toBe("100,0%");
  });
});
