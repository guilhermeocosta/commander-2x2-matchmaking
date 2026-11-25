/**
 * Player lifecycle rules (see "Drops and late joins" in docs/rules.md). `latestRound` is the
 * number of the latest round that is past draft (published or later), or 0 before round 1 is
 * published. A draft doesn't count: a drop or late join while round N is a draft applies to
 * round N, which the admin then re-rolls.
 */

/**
 * Most players an event takes, dropped players included. Well above the biggest event so far;
 * it stops a script from flooding the list through the public join page.
 */
export const MAX_PLAYERS_PER_EVENT = 40;

/** True once an event has as many players as it can take. */
export function isEventFull(playerCount: number): boolean {
  return playerCount >= MAX_PLAYERS_PER_EVENT;
}

/**
 * The first round a player joining now can play: the next round that hasn't been paired yet.
 * Before round 1 is paired that is round 1.
 */
export function joinRound(latestRound: number): number {
  return latestRound + 1;
}

/** True while a new player could still be paired in some round of the event. */
export function canStillPlay(latestRound: number, totalRounds: number): boolean {
  return joinRound(latestRound) <= totalRounds;
}

/**
 * The `dropped_after_round` value for a player dropping now: the latest paired round (they are
 * left out of every pairing after it), or 0 before round 1.
 */
export function dropAfterRound(latestRound: number): number {
  return latestRound;
}

export type PlayerStatus =
  { kind: "active" } | { kind: "dropped"; afterRound: number } | { kind: "late"; round: number };

/** What the admin list shows: ativo, desistiu, or entra na rodada N (not playing yet). */
export function playerStatus(
  player: { joinedRound: number; droppedAfterRound: number | null },
  latestRound: number
): PlayerStatus {
  if (player.droppedAfterRound !== null) {
    return { kind: "dropped", afterRound: player.droppedAfterRound };
  }
  if (player.joinedRound > 1 && player.joinedRound > latestRound) {
    return { kind: "late", round: player.joinedRound };
  }
  return { kind: "active" };
}
