/**
 * Round lifecycle rules for the admin (P07): who plays a round, when the next round can be
 * generated, planning a round with the pairing engine, swapping two players in a draft, and the
 * warnings shown before publishing. Pure: the caller loads and stores the data.
 */
import {
  EXTREME_GAP,
  MIN_PLAYERS,
  pairingHistory,
  pairingWarnings,
  pairRound,
  type PairingWarning,
} from "./pairing";
import { standings } from "./standings";
import type { PlayerId, RoundRecord, TableRecord } from "./types";

/** The fields of an event player that decide which rounds they play. */
export interface RoundPlayer {
  id: PlayerId;
  /** First round they can be paired in. */
  joinedRound: number;
  /** Last round they play before dropping; null while active. */
  droppedAfterRound: number | null;
}

/** True when the player is paired in round `round`. */
export function playsRound(player: RoundPlayer, round: number): boolean {
  return (
    player.joinedRound <= round &&
    (player.droppedAfterRound === null || player.droppedAfterRound >= round)
  );
}

/** Ids of the players paired in round `round`, in the order given. */
export function activePlayerIds(players: readonly RoundPlayer[], round: number): PlayerId[] {
  return players.filter((p) => playsRound(p, round)).map((p) => p.id);
}

export type RoundStatus = "draft" | "published" | "running" | "paused" | "overtime" | "closed";
export type EventStatus = "open" | "running" | "finished";

/** The latest round of an event, or null before round 1. */
export type LatestRound = { number: number; status: RoundStatus } | null;

/** Why "Gerar rodada N" is disabled. */
export type GenerateBlock =
  | { kind: "event-finished" }
  | { kind: "all-rounds-generated" }
  | { kind: "draft-pending"; round: number }
  | { kind: "previous-not-closed"; round: number }
  | { kind: "too-few-players"; active: number; min: number };

export type GenerateGate =
  { ok: true; round: number } | { ok: false; round: number; block: GenerateBlock };

/**
 * Whether the next round can be generated: round 1 once there are {@link MIN_PLAYERS} active
 * players; later rounds once the previous round is closed. Never past the event's last round.
 * `activeForNext` is the number of players who would play the next round.
 */
export function nextRoundGate(input: {
  eventStatus: EventStatus;
  totalRounds: number;
  latest: LatestRound;
  activeForNext: number;
}): GenerateGate {
  const { eventStatus, totalRounds, latest, activeForNext } = input;
  const round = (latest?.number ?? 0) + 1;
  const block = (b: GenerateBlock): GenerateGate => ({ ok: false, round, block: b });
  if (eventStatus === "finished") return block({ kind: "event-finished" });
  if (latest && latest.status === "draft") {
    return {
      ok: false,
      round: latest.number,
      block: { kind: "draft-pending", round: latest.number },
    };
  }
  if (round > totalRounds) return block({ kind: "all-rounds-generated" });
  if (latest && latest.status !== "closed") {
    return block({ kind: "previous-not-closed", round: latest.number });
  }
  if (activeForNext < MIN_PLAYERS) {
    return block({ kind: "too-few-players", active: activeForNext, min: MIN_PLAYERS });
  }
  return { ok: true, round };
}

/** The admin can finish the event once its last round is closed. */
export function canFinishEvent(input: {
  eventStatus: EventStatus;
  totalRounds: number;
  latest: LatestRound;
}): boolean {
  const { eventStatus, totalRounds, latest } = input;
  return (
    eventStatus === "running" &&
    latest !== null &&
    latest.number >= totalRounds &&
    latest.status === "closed"
  );
}

/** Points per player before a round, from the rounds already played. */
export function pointsBefore(
  playerIds: readonly PlayerId[],
  pastRounds: readonly RoundRecord[],
  tiebreakSeed: number
): Map<PlayerId, number> {
  return new Map(standings(playerIds, pastRounds, tiebreakSeed).map((s) => [s.playerId, s.points]));
}

/**
 * A {@link PairingWarning}, plus a 2-0 player teamed with a 0-2 player (priority 1). The engine
 * avoids that whenever it can, but at 6–7 players round 3 can force it, and an admin swap can
 * cause it.
 */
export type RoundWarning =
  PairingWarning | { kind: "extreme-teammates"; playerIds: [PlayerId, PlayerId] };

/** Every warning for a seated round, given the rounds before it and each player's points. */
export function roundWarnings(
  tables: readonly TableRecord[],
  pastRounds: readonly RoundRecord[],
  points: ReadonlyMap<PlayerId, number>
): RoundWarning[] {
  const warnings: RoundWarning[] = [];
  const pts = (id: PlayerId) => points.get(id) ?? 0;
  for (const { kind, seats } of tables) {
    if (kind !== "2v2") continue;
    for (const team of ["A", "B"] as const) {
      const [x, y] = seats.filter((s) => s.team === team).map((s) => s.playerId);
      if (x !== undefined && y !== undefined && Math.abs(pts(x) - pts(y)) >= EXTREME_GAP) {
        warnings.push({ kind: "extreme-teammates", playerIds: [x, y] });
      }
    }
  }
  return [...warnings, ...pairingWarnings(tables, pairingHistory(pastRounds))];
}

export interface PlanRoundInput {
  /** Every player of the event, dropped and late ones included. */
  players: readonly RoundPlayer[];
  /** The rounds before this one (all of them, in order). */
  pastRounds: readonly RoundRecord[];
  /** The round being paired (1-based). */
  round: number;
  /** The event's standings tiebreak seed. */
  tiebreakSeed: number;
  /** The pairing seed stored with the round. */
  seed: number;
}

export interface PlannedRound {
  tables: TableRecord[];
  warnings: RoundWarning[];
  /** Points of each seated player before this round. */
  points: Map<PlayerId, number>;
}

/**
 * Pairs round `round`: the players who play it, in standings order, with their history, through
 * `pairRound`. Deterministic: the same input (seed included) gives the same tables. Throws a
 * RangeError below {@link MIN_PLAYERS} active players.
 */
export function planRound(input: PlanRoundInput): PlannedRound {
  const { players, pastRounds, round, tiebreakSeed, seed } = input;
  const ids = activePlayerIds(players, round);
  if (ids.length < MIN_PLAYERS) {
    throw new RangeError(`round ${round} needs at least ${MIN_PLAYERS} active players`);
  }
  const table = standings(ids, pastRounds, tiebreakSeed);
  const { tables } = pairRound({
    players: table.map(({ playerId, points }) => ({ playerId, points })),
    history: pairingHistory(pastRounds),
    seed,
  });
  const points = new Map(table.map((s) => [s.playerId, s.points]));
  return { tables, warnings: roundWarnings(tables, pastRounds, points), points };
}

/**
 * Swaps the seats of two players in a round. Any two seated players can swap, across 2v2, 1v1
 * and bye tables: the number of seats per table doesn't change, so the layout stays valid.
 * Throws when a player isn't seated or both ids are the same.
 */
export function swapPlayers(
  tables: readonly TableRecord[],
  x: PlayerId,
  y: PlayerId
): TableRecord[] {
  if (x === y) throw new Error("pick two different players");
  const seated = new Set(tables.flatMap((t) => t.seats.map((s) => s.playerId)));
  if (!seated.has(x) || !seated.has(y)) throw new Error("both players must be seated");
  const other = (id: PlayerId) => (id === x ? y : id === y ? x : id);
  return tables.map((t) => ({
    ...t,
    seats: t.seats.map((s) => ({ ...s, playerId: other(s.playerId) })),
  }));
}

/**
 * True when a draft seats exactly the players who play its round now. False after a drop, an
 * undo or a late join since it was generated: it must be re-rolled before publishing.
 */
export function seatsMatchPlayers(
  tables: readonly TableRecord[],
  activeIds: readonly PlayerId[]
): boolean {
  const seated = tables.flatMap((t) => t.seats.map((s) => s.playerId));
  const active = new Set(activeIds);
  return seated.length === active.size && seated.every((id) => active.has(id));
}
