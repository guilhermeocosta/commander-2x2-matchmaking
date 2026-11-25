import { describe, expect, it } from "vitest";

import { filterRoster, parseRoster, searchKey } from "./roster";

describe("parseRoster", () => {
  it("keeps id and name, sorted by name", () => {
    const json = {
      year: 2026,
      players: [
        { id: "zeca", name: "Zeca", stats: { wins: 1 } },
        { id: "claudio-bonfim", name: "Cláudio Bonfim", avatar: null },
        { id: "arthur", name: " Arthur Castro " },
      ],
    };
    expect(parseRoster(json)).toEqual([
      { id: "arthur", name: "Arthur Castro" },
      { id: "claudio-bonfim", name: "Cláudio Bonfim" },
      { id: "zeca", name: "Zeca" },
    ]);
  });

  it("skips invalid entries and duplicate ids", () => {
    const json = {
      players: [
        { id: "ok", name: "Ok" },
        { id: "Not Kebab", name: "Bad id" },
        { id: "no-name", name: "" },
        { id: "too-long", name: "x".repeat(61) },
        { id: "ok", name: "Duplicate" },
        null,
        "string",
      ],
    };
    expect(parseRoster(json)).toEqual([{ id: "ok", name: "Ok" }]);
  });

  it("returns an empty roster for anything that isn't a leaderboard", () => {
    expect(parseRoster(null)).toEqual([]);
    expect(parseRoster("<html>")).toEqual([]);
    expect(parseRoster({ players: "nope" })).toEqual([]);
    expect(parseRoster([])).toEqual([]);
  });
});

describe("search", () => {
  const roster = [
    { id: "claudio-bonfim", name: "Cláudio Bonfim" },
    { id: "guilherme-costa", name: "Guilherme Costa" },
    { id: "raphael-souza", name: "Raphael Souza" },
  ];

  it("normalizes accents, case and spaces", () => {
    expect(searchKey("  CLÁUDIO   Bonfim ")).toBe("claudio bonfim");
  });

  it("matches every word, in any order", () => {
    expect(filterRoster(roster, "claudio")).toEqual([roster[0]]);
    expect(filterRoster(roster, "costa gui")).toEqual([roster[1]]);
    expect(filterRoster(roster, "s")).toEqual([roster[1], roster[2]]);
    expect(filterRoster(roster, "")).toEqual(roster);
    expect(filterRoster(roster, "ninguém")).toEqual([]);
  });
});
