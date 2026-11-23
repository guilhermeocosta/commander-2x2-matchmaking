/**
 * Pairing engine: seats one round following docs/rules.md (Table layout, Pairing priorities).
 *
 * Pure and deterministic: the same players, history and seed always give the same tables.
 */
import type { PlayerId, RoundRecord, Standing } from "./types";

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
