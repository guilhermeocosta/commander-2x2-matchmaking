import type { Outcome, PlayerId, TableRecord } from "./types";

/** Test-only builders for table records. */

export function twoVsTwo(
  [a1, a2]: [PlayerId, PlayerId],
  [b1, b2]: [PlayerId, PlayerId],
  outcome: Outcome | null
): TableRecord {
  return {
    kind: "2v2",
    seats: [
      { playerId: a1, team: "A", position: 1 },
      { playerId: b1, team: "B", position: 1 },
      { playerId: a2, team: "A", position: 2 },
      { playerId: b2, team: "B", position: 2 },
    ],
    outcome,
  };
}

export function oneVsOne(
  a: PlayerId,
  b: PlayerId,
  games: { a: number; b: number } | null,
  outcome: Outcome | null = null
): TableRecord {
  return {
    kind: "1v1",
    seats: [
      { playerId: a, team: "A", position: 1 },
      { playerId: b, team: "B", position: 1 },
    ],
    outcome,
    ...(games ? { games } : {}),
  };
}

export function bye(playerId: PlayerId): TableRecord {
  return { kind: "bye", seats: [{ playerId, team: "A", position: 1 }], outcome: null };
}
