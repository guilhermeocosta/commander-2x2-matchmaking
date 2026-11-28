/**
 * The standings as shown to people (player tab, admin, display): computed with `standings` from
 * the closed rounds, with names instead of ids. Plain JSON, public data only.
 */
import { standings } from "./standings.ts";
import type { RoundRecord } from "./types.ts";

export interface StandingRow {
  rank: number;
  name: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  /** Opponents' match-win %, in [0, 1]. */
  omw: number;
  /** True for a player who left the event (their results still count). */
  dropped: boolean;
}

export interface EventStandings {
  /** The last closed round the standings include. */
  throughRound: number;
  rows: StandingRow[];
}

export interface StandingsPlayer {
  id: string;
  displayName: string;
  joinedRound: number;
  droppedAfterRound: number | null;
}

/**
 * Standings after round `throughRound` (the last closed one), or null before any round closed.
 * Ranks every player who could have played by then, dropped ones included; a late joiner who
 * hasn't entered yet, and a player who dropped before their first round, are left out. Only
 * rounds up to `throughRound` count.
 */
export function eventStandings(input: {
  players: readonly StandingsPlayer[];
  rounds: readonly RoundRecord[];
  seed: number;
  throughRound: number;
}): EventStandings | null {
  const { players, seed, throughRound } = input;
  if (throughRound < 1) return null;
  const rounds = input.rounds.filter((r) => r.round <= throughRound);
  const eligible = players.filter((p) => playedAnyRound(p, throughRound));
  const byId = new Map(eligible.map((p) => [p.id, p]));
  const rows = standings(
    eligible.map((p) => p.id),
    rounds,
    seed
  ).map((s): StandingRow => {
    const player = byId.get(s.playerId);
    return {
      rank: s.rank,
      name: player?.displayName ?? "Jogador removido",
      points: s.points,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      omw: s.opponentsMatchWinPct,
      dropped: player ? player.droppedAfterRound !== null : false,
    };
  });
  return { throughRound, rows };
}

/** True when the player was due to play at least one round up to `throughRound`. */
function playedAnyRound(player: StandingsPlayer, throughRound: number): boolean {
  const lastRound = Math.min(player.droppedAfterRound ?? throughRound, throughRound);
  return player.joinedRound <= lastRound;
}

/** "2-1-0" (V-E-D). */
export function recordLabel(row: Pick<StandingRow, "wins" | "draws" | "losses">): string {
  return `${row.wins}-${row.draws}-${row.losses}`;
}

/** "55,6%" (pt-BR decimal comma); "—" for a player without opponents yet. */
export function omwLabel(omw: number): string {
  if (omw === 0) return "—";
  return `${(Math.round(omw * 1000) / 10).toFixed(1).replace(".", ",")}%`;
}
