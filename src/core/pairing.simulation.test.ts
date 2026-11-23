/**
 * Simulated events: N = 4..40 players, 3 rounds, random results, drops and late joins, several
 * seeds per N. Every round the engine pairs is checked against the rules' hard guarantees.
 */
import { describe, expect, it } from "vitest";
import {
  EXTREME_GAP,
  compareCost,
  pairRound,
  pairingHistory,
  seatingCost,
  tableLayout,
  type PairingHistory,
  type PairingPlayer,
  type PairRoundResult,
  type SeatingCost,
} from "./pairing";
import { createRng, randomInt, shuffle, type Rng } from "./rng";
import { standings } from "./standings";
import type { Outcome, PlayerId, RoundRecord, TableRecord } from "./types";

const ROUNDS = 3;
const SEEDS_PER_N = 4;
const MIN_N = 4;
const MAX_N = 40;

/** 2-0 after two rounds, and 0-2. */
const TOP = 6;
const BOTTOM = 0;

/** Events at least this big are expected to almost never repeat a teammate. */
const LARGE_N = 16;

interface Stats {
  /** Counted for events with at least {@link LARGE_N} players. */
  pairings: number;
  repeatedTeammates: number;
  repeatedOpponents: number;
  maxMs: number;
}

function randomOutcome(rng: Rng): Outcome {
  const r = rng();
  return r < 0.45 ? "A" : r < 0.9 ? "B" : "draw";
}

function playResults(tables: TableRecord[], rng: Rng): TableRecord[] {
  return tables.map((table) => {
    if (table.kind === "bye") return table;
    if (table.kind === "1v1") {
      const a = randomInt(rng, 3);
      const b = a === 2 ? randomInt(rng, 2) : randomInt(rng, 3 - a);
      return { ...table, games: { a, b } };
    }
    return { ...table, outcome: randomOutcome(rng) };
  });
}

const key = (a: PlayerId, b: PlayerId) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function pairsOf(table: TableRecord, sameTeam: boolean): [PlayerId, PlayerId][] {
  const out: [PlayerId, PlayerId][] = [];
  for (let i = 0; i < table.seats.length; i++) {
    for (let j = i + 1; j < table.seats.length; j++) {
      if ((table.seats[i].team === table.seats[j].team) === sameTeam) {
        out.push([table.seats[i].playerId, table.seats[j].playerId]);
      }
    }
  }
  return out;
}

function checkRound(
  large: boolean,
  round: number,
  active: PlayerId[],
  pointsOf: Map<PlayerId, number>,
  history: PairingHistory,
  { tables, warnings }: PairRoundResult,
  stats: Stats
) {
  const where = `round ${round}, ${active.length} players`;

  // Layout matches N mod 4.
  const layout = tableLayout(active.length);
  const count = (kind: TableRecord["kind"]) => tables.filter((t) => t.kind === kind).length;
  expect({ twoVsTwo: count("2v2"), oneVsOne: count("1v1"), byes: count("bye") }, where).toEqual(
    layout
  );

  // Every active player seated exactly once, nobody else.
  const seated = tables.flatMap((t) => t.seats.map((s) => s.playerId));
  expect(seated.slice().sort(), where).toEqual(active.slice().sort());

  // No second bye / 1v1 when avoidable.
  const hadBye = new Set(history.byes);
  const hadOneVsOne = new Set(history.oneVsOnes);
  const byeTable = tables.find((t) => t.kind === "bye");
  if (byeTable && active.some((id) => !hadBye.has(id))) {
    expect(hadBye.has(byeTable.seats[0].playerId), `${where}: second bye`).toBe(false);
  }
  const oneTable = tables.find((t) => t.kind === "1v1");
  if (oneTable) {
    const freshLeft = active.filter(
      (id) => !hadOneVsOne.has(id) && id !== byeTable?.seats[0].playerId
    );
    if (freshLeft.length >= 2) {
      for (const s of oneTable.seats) {
        expect(hadOneVsOne.has(s.playerId), `${where}: second 1v1`).toBe(false);
      }
    }
  }

  // Every repeated teammate and opponent is warned about.
  const pastTeammates = new Set(history.teammates.map(([a, b]) => key(a, b)));
  const pastOpponents = new Set(history.opponents.map(([a, b]) => key(a, b)));
  const warned = new Set(
    warnings.map((w) => `${w.kind}:${key(w.playerIds[0], w.playerIds[1] ?? "")}`)
  );
  for (const table of tables) {
    for (const [a, b] of pairsOf(table, true)) {
      if (!pastTeammates.has(key(a, b))) continue;
      if (large) stats.repeatedTeammates++;
      expect(warned.has(`repeated-teammate:${key(a, b)}`), `${where}: silent teammate`).toBe(true);
    }
    for (const [a, b] of pairsOf(table, false)) {
      if (!pastOpponents.has(key(a, b))) continue;
      if (large) stats.repeatedOpponents++;
      expect(warned.has(`repeated-opponent:${key(a, b)}`), `${where}: silent opponent`).toBe(true);
    }
  }

  // No table mixes 2-0 with 0-2 when the 2v2 players allow it, and never as teammates.
  if (round >= 2) {
    const pts = (id: PlayerId) => pointsOf.get(id) ?? 0;
    const fours = tables.filter((t) => t.kind === "2v2");
    const all = fours.flatMap((t) => t.seats.map((s) => pts(s.playerId)));
    const top = all.filter((p) => p >= TOP).length;
    const bottom = all.filter((p) => p <= BOTTOM).length;
    const middle = all.length - top - bottom;
    const avoidable = top === 0 || bottom === 0 || middle >= (4 - (top % 4)) % 4;
    if (avoidable) {
      for (const t of fours) {
        const values = t.seats.map((s) => pts(s.playerId));
        const mixed = values.some((p) => p >= TOP) && values.some((p) => p <= BOTTOM);
        expect(mixed, `${where}: 2-0 and 0-2 at one table: ${values.join(",")}`).toBe(false);
      }
    }
    for (const t of fours) {
      for (const [a, b] of pairsOf(t, true)) {
        // A forced extreme team only exists when a table must hold 2-0 and 0-2 players.
        if (avoidable) {
          expect(Math.abs(pts(a) - pts(b)) < EXTREME_GAP, `${where}: 2-0 teamed with 0-2`).toBe(
            true
          );
        }
      }
    }
  }
}

function simulateEvent(n: number, seed: number, stats: Stats) {
  const rng = createRng(seed * 7919 + n);
  let nextId = n + 1;
  const joined: PlayerId[] = Array.from({ length: n }, (_, i) => `p${i + 1}`);
  const dropped = new Set<PlayerId>();
  const rounds: RoundRecord[] = [];

  for (let round = 1; round <= ROUNDS; round++) {
    if (round > 1) {
      // Some late joins (0 points) and drops, keeping at least 4 active players.
      const joins = rng() < 0.35 ? 1 + randomInt(rng, 2) : 0;
      for (let j = 0; j < joins; j++) joined.push(`p${nextId++}`);
      const drops = rng() < 0.35 ? 1 + randomInt(rng, 2) : 0;
      for (let d = 0; d < drops; d++) {
        const candidates = joined.filter((id) => !dropped.has(id));
        if (candidates.length <= 4) break;
        dropped.add(candidates[randomInt(rng, candidates.length)]);
      }
    }
    const active = joined.filter((id) => !dropped.has(id));
    const table = standings(active, rounds, seed);
    const players = table.map(({ playerId, points }) => ({ playerId, points }));
    const history = pairingHistory(rounds);
    const pairingSeed = seed * 31 + round;

    const start = performance.now();
    const result = pairRound({ players, history, seed: pairingSeed });
    stats.maxMs = Math.max(stats.maxMs, performance.now() - start);
    if (n >= LARGE_N) stats.pairings++;

    // Same seed, same output.
    if (round === ROUNDS) {
      expect(
        pairRound({ players: players.map((p) => ({ ...p })), history, seed: pairingSeed })
      ).toEqual(result);
    }

    checkRound(
      n >= LARGE_N,
      round,
      active,
      new Map(players.map((p) => [p.playerId, p.points])),
      history,
      result,
      stats
    );
    rounds.push({ round, tables: playResults(result.tables, rng) });
  }
}

describe("simulated events", () => {
  const stats: Stats = { pairings: 0, repeatedTeammates: 0, repeatedOpponents: 0, maxMs: 0 };

  for (let n = MIN_N; n <= MAX_N; n++) {
    it(`pairs 3 rounds for ${n} players over ${SEEDS_PER_N} seeds`, () => {
      for (let seed = 1; seed <= SEEDS_PER_N; seed++) simulateEvent(n, seed, stats);
    });
  }

  it(`keeps repeated teammates bounded with ${LARGE_N}+ players`, () => {
    // Teammates share results, so former teammates often have the same points, and priority 2
    // (smallest teammate gap) outranks priority 4 (no repeated teammate). The repeats left are
    // the ones the rules' order forces; the brute-force test below shows the search finds the
    // best seating. Measured: ~0.14 repeated teammates per pairing. This bound catches a
    // regression in search quality, not a rules change.
    expect(stats.pairings).toBe((MAX_N - LARGE_N + 1) * SEEDS_PER_N * ROUNDS);
    expect(stats.repeatedTeammates / stats.pairings, JSON.stringify(stats)).toBeLessThan(0.2);
    expect(stats.maxMs).toBeLessThan(500);
  });
});

/** The best possible cost of seating `pool` at 2v2 tables, by trying every grouping. */
function bruteForceOptimum(
  pool: readonly PlayerId[],
  players: readonly PairingPlayer[],
  history: PairingHistory
): SeatingCost {
  const splits = [
    [0, 1, 2, 3],
    [0, 2, 1, 3],
    [0, 3, 1, 2],
  ];
  const bestTable = (four: PlayerId[]) => {
    let best: SeatingCost | null = null;
    for (const [a1, a2, b1, b2] of splits) {
      const table: TableRecord = {
        kind: "2v2",
        outcome: null,
        seats: [
          { playerId: four[a1], team: "A", position: 1 },
          { playerId: four[b1], team: "B", position: 1 },
          { playerId: four[a2], team: "A", position: 2 },
          { playerId: four[b2], team: "B", position: 2 },
        ],
      };
      const cost = seatingCost([table], players, history);
      if (best === null || compareCost(cost, best) < 0) best = cost;
    }
    return best!;
  };
  let best: SeatingCost | null = null;
  const visit = (rest: readonly PlayerId[], acc: SeatingCost) => {
    if (rest.length === 0) {
      if (best === null || compareCost(acc, best) < 0) best = acc;
      return;
    }
    const [first, ...others] = rest;
    for (let i = 0; i < others.length; i++) {
      for (let j = i + 1; j < others.length; j++) {
        for (let k = j + 1; k < others.length; k++) {
          const table = bestTable([first, others[i], others[j], others[k]]);
          const left = others.filter((_, q) => q !== i && q !== j && q !== k);
          visit(left, acc.map((v, e) => v + table[e]) as unknown as SeatingCost);
        }
      }
    }
  };
  visit(pool, [0, 0, 0, 0, 0, 0]);
  return best!;
}

describe("search quality", () => {
  it("finds the best seating for small events (checked by brute force)", () => {
    for (let n = 8; n <= 13; n++) {
      for (let seed = 1; seed <= 4; seed++) {
        const rng = createRng(seed * 104729 + n);
        const ids = Array.from({ length: n }, (_, i) => `p${i + 1}`);
        const rounds: RoundRecord[] = [];
        for (let round = 1; round <= ROUNDS; round++) {
          const players = standings(ids, rounds, seed).map(({ playerId, points }) => ({
            playerId,
            points,
          }));
          const history = pairingHistory(rounds);
          const { tables } = pairRound({ players, history, seed: seed * 31 + round });
          if (round > 1) {
            const fours = tables.filter((t) => t.kind === "2v2");
            const pool = fours.flatMap((t) => t.seats.map((s) => s.playerId));
            const got = seatingCost(fours, players, history);
            const best = bruteForceOptimum(pool, players, history);
            expect(compareCost(got, best), `n=${n} seed=${seed} round=${round}`).toBe(0);
          }
          rounds.push({ round, tables: playResults(tables, rng) });
        }
      }
    }
  });
});

describe("benchmark", () => {
  it("pairs 40 players in under 500 ms", () => {
    const rng = createRng(2026);
    const ids = shuffle(
      Array.from({ length: 40 }, (_, i) => `p${i + 1}`),
      rng
    );
    // Two played rounds of history, realistic points.
    const rounds: RoundRecord[] = [];
    for (let round = 1; round <= 2; round++) {
      const players = standings(ids, rounds, 1).map(({ playerId, points }) => ({
        playerId,
        points,
      }));
      const { tables } = pairRound({ players, history: pairingHistory(rounds), seed: round });
      rounds.push({ round, tables: playResults(tables, rng) });
    }
    const players = standings(ids, rounds, 1).map(({ playerId, points }) => ({ playerId, points }));
    const history = pairingHistory(rounds);

    const start = performance.now();
    pairRound({ players, history, seed: 3 });
    const ms = performance.now() - start;
    expect(ms).toBeLessThan(500);
  });
});
