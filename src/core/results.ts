import type {
  MatchResult,
  Outcome,
  PlayerId,
  PlayerRoundResult,
  RoundRecord,
  TableRecord,
  Team,
} from "./types";

/**
 * 1v1 match result from games won, per the Magic Tournament Rules: whoever won more games
 * wins the match; equal games (1-1, 0-0) is a draw. Drawn or unfinished games are not counted.
 */
export function oneVsOneOutcome(gamesA: number, gamesB: number): Outcome {
  for (const g of [gamesA, gamesB]) {
    if (!Number.isInteger(g) || g < 0 || g > 2) {
      throw new RangeError("1v1 games won must be an integer from 0 to 2");
    }
  }
  if (gamesA === 2 && gamesB === 2) throw new RangeError("1v1 is best of 3");
  if (gamesA > gamesB) return "A";
  if (gamesB > gamesA) return "B";
  return "draw";
}

/** The table's outcome, or `null` if not reported yet. Not meaningful for a bye. */
export function tableOutcome(table: TableRecord): Outcome | null {
  if (table.outcome !== null) return table.outcome;
  if (table.kind === "1v1" && table.games) return oneVsOneOutcome(table.games.a, table.games.b);
  return null;
}

const SEATS_PER_TEAM = { "2v2": 2, "1v1": 1, bye: 0 } as const;

function assertValidTable(table: TableRecord, round: number): void {
  const { kind, seats } = table;
  if (kind === "bye") {
    if (seats.length !== 1) throw new Error(`round ${round}: a bye has exactly one seat`);
    return;
  }
  const perTeam = SEATS_PER_TEAM[kind];
  const a = seats.filter((s) => s.team === "A").length;
  const b = seats.filter((s) => s.team === "B").length;
  if (a !== perTeam || b !== perTeam || seats.length !== perTeam * 2) {
    throw new Error(`round ${round}: a ${kind} table has ${perTeam} seat(s) per team`);
  }
}

function resultFor(team: Team, outcome: Outcome): MatchResult {
  if (outcome === "draw") return "draw";
  return outcome === team ? "win" : "loss";
}

/**
 * Each player's result per round, ordered by round. Both teammates share the table result;
 * a bye is a win. Tables without a result yet are skipped, and rounds a player did not play
 * (late join, drop) produce no entry: they count as nothing.
 *
 * Throws if a table has the wrong number of seats or a player sits twice in one round.
 */
export function playerResults(
  rounds: readonly RoundRecord[]
): Record<PlayerId, PlayerRoundResult[]> {
  const byPlayer: Record<PlayerId, PlayerRoundResult[]> = {};
  const ordered = rounds.slice().sort((x, y) => x.round - y.round);

  for (const { round, tables } of ordered) {
    const seated = new Set<PlayerId>();
    for (const table of tables) {
      assertValidTable(table, round);
      for (const { playerId } of table.seats) {
        if (seated.has(playerId)) throw new Error(`round ${round}: a player is seated twice`);
        seated.add(playerId);
      }

      if (table.kind === "bye") {
        const [{ playerId }] = table.seats;
        (byPlayer[playerId] ??= []).push({
          round,
          kind: "bye",
          result: "bye",
          teammates: [],
          opponents: [],
        });
        continue;
      }

      const outcome = tableOutcome(table);
      if (outcome === null) continue;

      for (const seat of table.seats) {
        (byPlayer[seat.playerId] ??= []).push({
          round,
          kind: table.kind,
          result: resultFor(seat.team, outcome),
          teammates: table.seats
            .filter((s) => s.team === seat.team && s.playerId !== seat.playerId)
            .map((s) => s.playerId),
          opponents: table.seats.filter((s) => s.team !== seat.team).map((s) => s.playerId),
        });
      }
    }
  }
  return byPlayer;
}
