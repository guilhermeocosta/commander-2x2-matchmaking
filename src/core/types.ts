/**
 * Shared domain types for Commander 2x2 events.
 *
 * Everything here is plain data (strings, numbers, arrays, objects) so it can be
 * serialized to JSON, stored in the database and sent to the browser unchanged.
 * Vocabulary follows CONTEXT.md.
 */

/** Stable id of an event player (`EventPlayer.id`). */
export type PlayerId = string;

/** A side at a table. Both teammates of a team share its result. */
export type Team = "A" | "B";

/** Seat number inside a team: A1, A2, B1, B2. */
export type SeatPosition = 1 | 2;

/** `2v2`: four players. `1v1`: best of 3, seats A1 and B1. `bye`: one player, seat A1. */
export type TableKind = "2v2" | "1v1" | "bye";

/** A table's result, per team. */
export type Outcome = Team | "draw";

/** A player's place at a table. */
export interface Seat {
  playerId: PlayerId;
  team: Team;
  position: SeatPosition;
}

/** Games won by each side of a 1v1 match. Drawn or unfinished games are not counted. */
export interface OneVsOneGames {
  a: number;
  b: number;
}

/** One table of a round, as played. */
export interface TableRecord {
  kind: TableKind;
  seats: Seat[];
  /**
   * The table's result. `null` while not reported (the table then counts as nothing yet).
   * Ignored for a bye, which is always a win. For a 1v1 table this is authoritative when set;
   * when `null`, it is derived from `games` if present.
   */
  outcome: Outcome | null;
  /** 1v1 only: games won per side, as reported. */
  games?: OneVsOneGames;
}

/** Every table of one past (or in-progress) round. */
export interface RoundRecord {
  /** 1-based round number. */
  round: number;
  tables: TableRecord[];
}

/** A player's result for one round. A bye scores as a win. */
export type MatchResult = "win" | "draw" | "loss" | "bye";

/** What one player got in one round they played. */
export interface PlayerRoundResult {
  round: number;
  kind: TableKind;
  result: MatchResult;
  /** Empty for a bye and for a 1v1 table. */
  teammates: PlayerId[];
  /** Empty for a bye. */
  opponents: PlayerId[];
}

/** One row of the event standings. */
export interface Standing {
  /** 1-based; unique, since the seeded draw breaks every tie. */
  rank: number;
  playerId: PlayerId;
  points: number;
  /** Byes counted as wins. */
  wins: number;
  draws: number;
  losses: number;
  /** Byes counted as matches played. */
  matchesPlayed: number;
  /** In [0, 1]. */
  matchWinPct: number;
  /** Opponents' match-win %, in [0.33, 1], or 0 when the player has faced no opponent. */
  opponentsMatchWinPct: number;
}
