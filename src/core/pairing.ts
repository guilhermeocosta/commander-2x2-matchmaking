/**
 * Pairing engine: seats one round following docs/rules.md (Table layout, Pairing priorities).
 *
 * Pure and deterministic: the same players, history and seed always give the same tables.
 */
import { createRng, shuffle, type Rng } from "./rng";
import type { PlayerId, RoundRecord, Seat, Standing, TableRecord } from "./types";

/** A round can't be paired with fewer active players than this. */
export const MIN_PLAYERS = 4;

/** How many tables of each kind a round with `n` active players has. */
export interface TableLayout {
  twoVsTwo: number;
  oneVsOne: number;
  byes: number;
}

/**
 * Tables per `n mod 4`: 0 → all 2v2; 1 → + a bye; 2 → + a 1v1; 3 → + a 1v1 and a bye.
 * Throws a RangeError below {@link MIN_PLAYERS}.
 */
export function tableLayout(n: number): TableLayout {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError("player count must be a non-negative integer");
  }
  if (n < MIN_PLAYERS) {
    throw new RangeError(`a round needs at least ${MIN_PLAYERS} active players, got ${n}`);
  }
  const rest = n % 4;
  return {
    twoVsTwo: Math.floor(n / 4),
    oneVsOne: rest >= 2 ? 1 : 0,
    byes: rest === 1 || rest === 3 ? 1 : 0,
  };
}

/**
 * Who sat with and against whom in past rounds of the event. A pair seated together twice is
 * listed twice. Ids of players who are no longer active are allowed and ignored.
 */
export interface PairingHistory {
  teammates: readonly (readonly [PlayerId, PlayerId])[];
  opponents: readonly (readonly [PlayerId, PlayerId])[];
  byes: readonly PlayerId[];
  oneVsOnes: readonly PlayerId[];
}

/** An active player to seat, with their current points. */
export type PairingPlayer = Pick<Standing, "playerId" | "points">;

/**
 * Builds the history from past rounds. Seats count whether or not a result was reported:
 * having sat together is what matters for pairing.
 */
export function pairingHistory(rounds: readonly RoundRecord[]): PairingHistory {
  const teammates: [PlayerId, PlayerId][] = [];
  const opponents: [PlayerId, PlayerId][] = [];
  const byes: PlayerId[] = [];
  const oneVsOnes: PlayerId[] = [];
  for (const { tables } of rounds) {
    for (const { kind, seats } of tables) {
      if (kind === "bye") {
        byes.push(...seats.map((s) => s.playerId));
        continue;
      }
      if (kind === "1v1") oneVsOnes.push(...seats.map((s) => s.playerId));
      for (let i = 0; i < seats.length; i++) {
        for (let j = i + 1; j < seats.length; j++) {
          const pair: [PlayerId, PlayerId] = [seats[i].playerId, seats[j].playerId];
          (seats[i].team === seats[j].team ? teammates : opponents).push(pair);
        }
      }
    }
  }
  return { teammates, opponents, byes, oneVsOnes };
}

/** Players chosen for the special seats, plus everyone left for the 2v2 tables. */
export interface SpecialSeats {
  bye: PlayerId | null;
  oneVsOne: [PlayerId, PlayerId] | null;
  /** The remaining players, in the order they were given. */
  rest: PlayerId[];
}

/**
 * Picks the bye and the 1v1 players from the bottom of `order` (best player first):
 *
 * - Bye: the lowest player who hasn't had a bye (the lowest player if everyone has).
 * - 1v1: the lowest remaining player who hasn't played 1v1, then the next lowest who hasn't
 *   played 1v1 and hasn't faced them; failing that, a rematch; failing that, players who
 *   already played 1v1, from the bottom.
 *
 * For round 1, pass a shuffled order: the pick is then random.
 */
export function assignSpecialSeats(
  order: readonly PlayerId[],
  history: PairingHistory
): SpecialSeats {
  const layout = tableLayout(order.length);
  const hadBye = new Set(history.byes);
  const hadOneVsOne = new Set(history.oneVsOnes);
  const faced = pairSet(history.opponents);

  const rest = order.slice();
  const takeFromBottom = (pick: (id: PlayerId) => boolean): PlayerId | null => {
    for (let i = rest.length - 1; i >= 0; i--) {
      if (pick(rest[i])) return rest.splice(i, 1)[0];
    }
    return null;
  };

  let bye: PlayerId | null = null;
  if (layout.byes > 0) bye = takeFromBottom((id) => !hadBye.has(id)) ?? takeFromBottom(() => true);

  let oneVsOne: [PlayerId, PlayerId] | null = null;
  if (layout.oneVsOne > 0) {
    const fresh = (id: PlayerId) => !hadOneVsOne.has(id);
    const first = takeFromBottom(fresh) ?? takeFromBottom(() => true);
    if (first === null) throw new Error("unreachable: no player left for the 1v1 table");
    const second =
      takeFromBottom((id) => fresh(id) && !faced.has(pairKey(first, id))) ??
      takeFromBottom(fresh) ??
      takeFromBottom((id) => !faced.has(pairKey(first, id))) ??
      takeFromBottom(() => true);
    if (second === null) throw new Error("unreachable: no player left for the 1v1 table");
    oneVsOne = [first, second];
  }

  return { bye, oneVsOne, rest };
}

/** Order-independent key for a pair of players. */
function pairKey(a: PlayerId, b: PlayerId): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

function pairSet(pairs: readonly (readonly [PlayerId, PlayerId])[]): Set<string> {
  return new Set(pairs.map(([a, b]) => pairKey(a, b)));
}

// ---------------------------------------------------------------------------------------------
// Seating search
// ---------------------------------------------------------------------------------------------

/** A points gap this large between teammates means a 2-0 player teamed with a 0-2 player. */
export const EXTREME_GAP = 6;

/** Restarts of the local search, each from a fresh seeded Swiss seating. */
const RESTARTS = 8;
/** Full passes over every swap per restart. A pass that finds no improvement ends it early. */
const MAX_PASSES = 25;

/**
 * Cost of a seating, compared lexicographically (never summed into one number), so a lower
 * priority can never outweigh a higher one. Lower is better. Each entry is summed over tables.
 */
export type SeatingCost = readonly [
  /** Priority 1: teammate pairs two wins apart (2-0 with 0-2), zero whenever any seating allows. */
  extremeTeammates: number,
  /** Priority 2: squared points spread (max − min) per table. */
  spread: number,
  /** Priority 3: players getting a second bye or a second 1v1. */
  secondSpecial: number,
  /** Priority 4: teammate pairs who were teammates before. */
  repeatedTeammates: number,
  /** Priority 5: squared points gap per pair of teammates. */
  teammateGap: number,
  /** Priority 6: opponent pairs who faced each other before. */
  repeatedOpponents: number,
];

/** Negative when `a` is better than `b`, positive when worse, 0 when equal. */
export function compareCost(a: SeatingCost, b: SeatingCost): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** A broken priority 3, 4 or 6 the admin should know about before publishing. */
export type PairingWarning =
  | { kind: "second-bye"; playerIds: [PlayerId] }
  | { kind: "second-1v1"; playerIds: [PlayerId] }
  | { kind: "repeated-teammate"; playerIds: [PlayerId, PlayerId] }
  | { kind: "repeated-opponent"; playerIds: [PlayerId, PlayerId] };

export interface PairRoundInput {
  /** Active players for this round, best first (standings order). Dropped players excluded. */
  players: readonly PairingPlayer[];
  history: PairingHistory;
  /** Stored with the round so it can be reproduced; a new seed re-rolls. */
  seed: number;
}

export interface PairRoundResult {
  /** 2v2 tables (best first), then the 1v1 table, then the bye. Outcomes are `null`. */
  tables: TableRecord[];
  warnings: PairingWarning[];
}

/**
 * Seats one round. Round 1 (empty history) is random. Later rounds start from a Swiss seating
 * (points brackets top-down, leftovers pairing down) and improve it with a seeded local search
 * over swaps, minimizing {@link SeatingCost}. Bye and 1v1 players come from
 * {@link assignSpecialSeats}. Throws on fewer than 4 players or a duplicate player id.
 */
export function pairRound({ players, history, seed }: PairRoundInput): PairRoundResult {
  const ids = players.map((p) => p.playerId);
  if (new Set(ids).size !== ids.length) throw new Error("a player is listed twice");
  for (const p of players) {
    if (!Number.isFinite(p.points)) throw new RangeError("player points must be finite");
  }
  tableLayout(players.length);

  const rng = createRng(seed);
  const pointsOf = new Map(players.map((p) => [p.playerId, p.points]));
  const firstRound =
    history.teammates.length + history.opponents.length + history.byes.length === 0 &&
    history.oneVsOnes.length === 0;
  const order = firstRound
    ? shuffle(ids, rng)
    : players
        .map((p, i) => ({ p, i }))
        .sort((x, y) => y.p.points - x.p.points || x.i - y.i)
        .map(({ p }) => p.playerId);

  const special = assignSpecialSeats(order, history);
  const ctx = new SearchContext(special.rest, pointsOf, history);
  const seating = ctx.search(rng);

  const tables: TableRecord[] = ctx
    .tablesOf(seating)
    .map(([teamA, teamB]) => twoVsTwoTable(teamA, teamB));
  if (special.oneVsOne) {
    const [x, y] = special.oneVsOne;
    const [a, b] = (pointsOf.get(y) ?? 0) > (pointsOf.get(x) ?? 0) ? [y, x] : [x, y];
    tables.push({
      kind: "1v1",
      seats: [seat(a, "A", 1), seat(b, "B", 1)],
      outcome: null,
    });
  }
  if (special.bye) tables.push({ kind: "bye", seats: [seat(special.bye, "A", 1)], outcome: null });

  return { tables, warnings: pairingWarnings(tables, history) };
}

/**
 * Splits four players into two teams, comparing the splits by `splitCost`: never a 2-0 with a
 * 0-2 player, then the fewest repeated teammates, then the smallest points gap between
 * teammates, then the fewest repeated opponents (docs/rules.md). Change the rule only here and
 * in `splitCost`.
 *
 * Returns the indexes into `four` of team A and team B, with the stronger team as A.
 */
export function chooseTeams(
  four: readonly number[],
  points: (i: number) => number,
  splitCost: (teamA: [number, number], teamB: [number, number]) => readonly number[]
): [[number, number], [number, number]] {
  let best: [[number, number], [number, number]] | null = null;
  let bestCost: readonly number[] | null = null;
  for (const [x, y] of SPLITS) {
    const teamA: [number, number] = [four[x[0]], four[x[1]]];
    const teamB: [number, number] = [four[y[0]], four[y[1]]];
    const cost = splitCost(teamA, teamB);
    if (bestCost === null || lexLess(cost, bestCost)) {
      best = [teamA, teamB];
      bestCost = cost;
    }
  }
  const [a, b] = best!;
  return points(b[0]) + points(b[1]) > points(a[0]) + points(a[1]) ? [b, a] : [a, b];
}

/** The three ways to split four seats into two teams. */
const SPLITS: readonly [[number, number], [number, number]][] = [
  [
    [0, 1],
    [2, 3],
  ],
  [
    [0, 2],
    [1, 3],
  ],
  [
    [0, 3],
    [1, 2],
  ],
];

function lexLess(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

/**
 * Cost of a full round as seated, using the same rules as the search. Useful to compare the
 * engine's output with an admin's edited version (P07).
 */
export function seatingCost(
  tables: readonly TableRecord[],
  players: readonly PairingPlayer[],
  history: PairingHistory
): SeatingCost {
  const pointsOf = new Map(players.map((p) => [p.playerId, p.points]));
  const pts = (id: PlayerId) => pointsOf.get(id) ?? 0;
  const teammates = pairSet(history.teammates);
  const opponents = pairSet(history.opponents);
  const hadBye = new Set(history.byes);
  const hadOneVsOne = new Set(history.oneVsOnes);
  const cost = [0, 0, 0, 0, 0, 0];
  for (const { kind, seats } of tables) {
    if (kind === "bye") {
      cost[2] += seats.filter((s) => hadBye.has(s.playerId)).length;
      continue;
    }
    if (kind === "1v1") cost[2] += seats.filter((s) => hadOneVsOne.has(s.playerId)).length;
    const values = seats.map((s) => pts(s.playerId));
    const spread = Math.max(...values) - Math.min(...values);
    cost[1] += spread * spread;
    for (let i = 0; i < seats.length; i++) {
      for (let j = i + 1; j < seats.length; j++) {
        const [x, y] = [seats[i].playerId, seats[j].playerId];
        if (seats[i].team === seats[j].team) {
          const gap = Math.abs(pts(x) - pts(y));
          if (gap >= EXTREME_GAP) cost[0]++;
          cost[4] += gap * gap;
          if (teammates.has(pairKey(x, y))) cost[3]++;
        } else if (opponents.has(pairKey(x, y))) {
          cost[5]++;
        }
      }
    }
  }
  return cost as unknown as SeatingCost;
}

/**
 * Every broken priority 3, 4 or 6 in a seated round: a second bye or 1v1, and each pair of
 * teammates or opponents who already sat together that way.
 */
export function pairingWarnings(
  tables: readonly TableRecord[],
  history: PairingHistory
): PairingWarning[] {
  const teammates = pairSet(history.teammates);
  const opponents = pairSet(history.opponents);
  const hadBye = new Set(history.byes);
  const hadOneVsOne = new Set(history.oneVsOnes);
  const warnings: PairingWarning[] = [];
  for (const { kind, seats } of tables) {
    for (const { playerId } of seats) {
      if (kind === "bye" && hadBye.has(playerId)) {
        warnings.push({ kind: "second-bye", playerIds: [playerId] });
      }
      if (kind === "1v1" && hadOneVsOne.has(playerId)) {
        warnings.push({ kind: "second-1v1", playerIds: [playerId] });
      }
    }
    for (let i = 0; i < seats.length; i++) {
      for (let j = i + 1; j < seats.length; j++) {
        const pair: [PlayerId, PlayerId] = [seats[i].playerId, seats[j].playerId];
        const sameTeam = seats[i].team === seats[j].team;
        if (sameTeam && teammates.has(pairKey(...pair))) {
          warnings.push({ kind: "repeated-teammate", playerIds: pair });
        } else if (!sameTeam && opponents.has(pairKey(...pair))) {
          warnings.push({ kind: "repeated-opponent", playerIds: pair });
        }
      }
    }
  }
  return warnings;
}

function seat(playerId: PlayerId, team: Seat["team"], position: Seat["position"]): Seat {
  return { playerId, team, position };
}

/** Seats in turn order A1, B1, A2, B2: teammates in opposite corners. */
function twoVsTwoTable([a1, a2]: PlayerId[], [b1, b2]: PlayerId[]): TableRecord {
  return {
    kind: "2v2",
    seats: [seat(a1, "A", 1), seat(b1, "B", 1), seat(a2, "A", 2), seat(b2, "B", 2)],
    outcome: null,
  };
}

/** Per-table cost: the {@link SeatingCost} entries a 2v2 table can change, in the same order. */
type TableCost = [extreme: number, spread: number, teammate: number, gap: number, opp: number];

/**
 * The 2v2 players as indexes 0..n−1, with points and history in flat arrays so the inner loop
 * of the search allocates little. A seating is an array of player indexes; table t holds
 * positions 4t..4t+3.
 */
class SearchContext {
  private readonly ids: readonly PlayerId[];
  private readonly points: Float64Array;
  private readonly teammates: Uint8Array;
  private readonly opponents: Uint8Array;
  private readonly n: number;
  private readonly tableCount: number;

  constructor(
    ids: readonly PlayerId[],
    pointsOf: ReadonlyMap<PlayerId, number>,
    history: PairingHistory
  ) {
    this.ids = ids;
    this.n = ids.length;
    this.tableCount = ids.length / 4;
    this.points = Float64Array.from(ids, (id) => pointsOf.get(id) ?? 0);
    const index = new Map(ids.map((id, i) => [id, i]));
    const matrix = (pairs: PairingHistory["teammates"]) => {
      const m = new Uint8Array(this.n * this.n);
      for (const [a, b] of pairs) {
        const i = index.get(a);
        const j = index.get(b);
        if (i === undefined || j === undefined) continue;
        m[i * this.n + j] = 1;
        m[j * this.n + i] = 1;
      }
      return m;
    };
    this.teammates = matrix(history.teammates);
    this.opponents = matrix(history.opponents);
  }

  /** Best seating over the restarts. Ties keep the earlier restart, so it is deterministic. */
  search(rng: Rng): Int32Array {
    let best: Int32Array | null = null;
    let bestCost: number[] | null = null;
    for (let r = 0; r < RESTARTS; r++) {
      const seating = this.swissStart(rng);
      const cost = this.climb(seating, rng);
      if (bestCost === null || lexLess(cost, bestCost)) {
        best = seating;
        bestCost = cost;
      }
      if (bestCost.every((c) => c === 0)) break;
    }
    return best!;
  }

  /** Teams per table, with the strongest table first. */
  tablesOf(seating: Int32Array): [PlayerId[], PlayerId[]][] {
    const tables: { teams: [PlayerId[], PlayerId[]]; top: number; sum: number }[] = [];
    for (let t = 0; t < this.tableCount; t++) {
      const four = Array.from(seating.subarray(4 * t, 4 * t + 4));
      const [a, b] = this.teamsOf(four);
      const values = four.map((i) => this.points[i]);
      tables.push({
        teams: [a.map((i) => this.ids[i]), b.map((i) => this.ids[i])],
        top: Math.max(...values),
        sum: values.reduce((s, v) => s + v, 0),
      });
    }
    // Stable sort: equal tables keep the search's (seeded) order.
    tables.sort((x, y) => y.top - x.top || y.sum - x.sum);
    return tables.map((t) => t.teams);
  }

  /** Points brackets top-down, shuffled inside each bracket; leftovers pair down. */
  private swissStart(rng: Rng): Int32Array {
    const order = Array.from({ length: this.n }, (_, i) => i);
    const brackets = new Map<number, number[]>();
    for (const i of order) {
      const key = this.points[i];
      if (!brackets.has(key)) brackets.set(key, []);
      brackets.get(key)!.push(i);
    }
    const seating: number[] = [];
    for (const key of [...brackets.keys()].sort((a, b) => b - a)) {
      seating.push(...shuffle(brackets.get(key)!, rng));
    }
    return Int32Array.from(seating);
  }

  /** First-improvement hill climbing over swaps between tables, in a seeded order. */
  private climb(seating: Int32Array, rng: Rng): number[] {
    const k = this.tableCount;
    const costs: TableCost[] = [];
    for (let t = 0; t < k; t++) costs.push(this.tableCost(seating, t));
    const total = sumCosts(costs);

    const pairs: [number, number][] = [];
    for (let t1 = 0; t1 < k; t1++) for (let t2 = t1 + 1; t2 < k; t2++) pairs.push([t1, t2]);
    const visit = shuffle(pairs, rng);

    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let improved = false;
      for (const [t1, t2] of visit) {
        for (let i = 4 * t1; i < 4 * t1 + 4; i++) {
          for (let j = 4 * t2; j < 4 * t2 + 4; j++) {
            swap(seating, i, j);
            const c1 = this.tableCost(seating, t1);
            const c2 = this.tableCost(seating, t2);
            let better = false;
            for (let e = 0; e < 5; e++) {
              const before = costs[t1][e] + costs[t2][e];
              const after = c1[e] + c2[e];
              if (after !== before) {
                better = after < before;
                break;
              }
            }
            if (better) {
              for (let e = 0; e < 5; e++) total[e] += c1[e] + c2[e] - costs[t1][e] - costs[t2][e];
              costs[t1] = c1;
              costs[t2] = c2;
              improved = true;
            } else {
              swap(seating, i, j);
            }
          }
        }
      }
      if (!improved) break;
    }
    return total;
  }

  private tableCost(seating: Int32Array, t: number): TableCost {
    const four = [seating[4 * t], seating[4 * t + 1], seating[4 * t + 2], seating[4 * t + 3]];
    const values = four.map((i) => this.points[i]);
    const spread = Math.max(...values) - Math.min(...values);
    const [a, b] = this.teamsOf(four);
    const split = this.splitCost(a, b);
    return [split[0], spread * spread, split[1], split[2], split[3]];
  }

  private teamsOf(four: number[]): [[number, number], [number, number]] {
    return chooseTeams(
      four,
      (i) => this.points[i],
      (a, b) => this.splitCost(a, b)
    );
  }

  /** [extreme teammates, repeated teammates, squared teammate gaps, repeated opponents]. */
  private splitCost([a1, a2]: [number, number], [b1, b2]: [number, number]): number[] {
    const n = this.n;
    const gapA = Math.abs(this.points[a1] - this.points[a2]);
    const gapB = Math.abs(this.points[b1] - this.points[b2]);
    const extreme = (gapA >= EXTREME_GAP ? 1 : 0) + (gapB >= EXTREME_GAP ? 1 : 0);
    const teammate = this.teammates[a1 * n + a2] + this.teammates[b1 * n + b2];
    const opp =
      this.opponents[a1 * n + b1] +
      this.opponents[a1 * n + b2] +
      this.opponents[a2 * n + b1] +
      this.opponents[a2 * n + b2];
    return [extreme, teammate, gapA * gapA + gapB * gapB, opp];
  }
}

function swap(a: Int32Array, i: number, j: number): void {
  const tmp = a[i];
  a[i] = a[j];
  a[j] = tmp;
}

function sumCosts(costs: readonly TableCost[]): number[] {
  const total = [0, 0, 0, 0, 0];
  for (const c of costs) for (let e = 0; e < 5; e++) total[e] += c[e];
  return total;
}
