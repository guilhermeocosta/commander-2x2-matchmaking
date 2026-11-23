import { playerResults } from "./results";
import { createRng, shuffle } from "./rng";
import type { MatchResult, PlayerId, PlayerRoundResult, RoundRecord, Standing } from "./types";

/** Lowest match-win % an opponent contributes to a tiebreaker. */
export const OMW_FLOOR = 0.33;

const POINTS: Record<MatchResult, number> = { win: 3, bye: 3, draw: 1, loss: 0 };

/** Two percentages closer than this are treated as tied (guards float noise). */
const EPSILON = 1e-9;

/** 3 per win or bye, 1 per draw, 0 per loss. */
export function points(results: readonly PlayerRoundResult[]): number {
  return results.reduce((sum, r) => sum + POINTS[r.result], 0);
}

/** Wins (byes included), draws, losses and matches played (byes included). */
export function record(results: readonly PlayerRoundResult[]) {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  for (const r of results) {
    if (r.result === "win" || r.result === "bye") wins++;
    else if (r.result === "draw") draws++;
    else losses++;
  }
  return { wins, draws, losses, matchesPlayed: results.length };
}

/** (wins × 3 + draws) ÷ (matches × 3), byes as wins and matches. 0 with no matches. */
export function matchWinPct(results: readonly PlayerRoundResult[]): number {
  if (results.length === 0) return 0;
  return points(results) / (results.length * 3);
}

/**
 * Average of each opponent's match-win %, floored at 33% per opponent. Byes have no opponent,
 * so they add nothing. Every opponent of every match counts (two per 2v2, one per 1v1), and an
 * opponent faced twice counts twice. Dropped players keep counting through their past results.
 * 0 when the player has faced no opponent.
 */
export function opponentsMatchWinPct(
  playerId: PlayerId,
  byPlayer: Readonly<Record<PlayerId, readonly PlayerRoundResult[]>>
): number {
  const opponents = (byPlayer[playerId] ?? []).flatMap((r) => r.opponents);
  if (opponents.length === 0) return 0;
  const total = opponents.reduce(
    (sum, id) => sum + Math.max(OMW_FLOOR, matchWinPct(byPlayer[id] ?? [])),
    0
  );
  return total / opponents.length;
}

/**
 * Event standings: points, then opponents' match-win %, then a random draw from `seed`.
 * Only `players` are ranked (include dropped players to show them); every player in `rounds`
 * still counts toward tiebreakers. The result does not depend on the order of `players`.
 */
export function standings(
  players: readonly PlayerId[],
  rounds: readonly RoundRecord[],
  seed: number
): Standing[] {
  const byPlayer = playerResults(rounds);
  const unique = [...new Set(players)].sort();
  const draw = new Map(shuffle(unique, createRng(seed)).map((id, i) => [id, i]));

  const rows = unique.map((playerId) => {
    const results = byPlayer[playerId] ?? [];
    return {
      playerId,
      points: points(results),
      ...record(results),
      matchWinPct: matchWinPct(results),
      opponentsMatchWinPct: opponentsMatchWinPct(playerId, byPlayer),
    };
  });

  rows.sort((x, y) => {
    if (x.points !== y.points) return y.points - x.points;
    const omw = y.opponentsMatchWinPct - x.opponentsMatchWinPct;
    if (Math.abs(omw) > EPSILON) return omw;
    return (draw.get(x.playerId) ?? 0) - (draw.get(y.playerId) ?? 0);
  });

  return rows.map((row, i) => ({ rank: i + 1, ...row }));
}
