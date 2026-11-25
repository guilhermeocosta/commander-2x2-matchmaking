import "server-only";

import {
  activePlayerIds,
  canFinishEvent,
  nextRoundGate,
  pointsBefore,
  roundWarnings,
  seatsMatchPlayers,
  type GenerateGate,
  type LatestRound,
  type RoundWarning,
} from "@/core/rounds";
import type { RoundRecord } from "@/core/types";
import {
  getLatestRound,
  getRoundRecords,
  getRoundState,
  listEventPlayers,
  type RoundState,
} from "@/db/queries";
import type { EventPlayerRow, EventRow } from "@/db/schema";

/**
 * Everything the admin "Rodadas" section and the round actions read about an event's rounds,
 * loaded the same way for both so the page and the server agree on what is allowed.
 */
export interface RoundsContext {
  players: EventPlayerRow[];
  latest: LatestRound;
  /** The latest round with its tables, when there is one. */
  current: CurrentRound | null;
  /** Whether "Gerar rodada N" is allowed, and for which N. */
  gate: GenerateGate;
  canFinish: boolean;
}

export interface CurrentRound {
  state: RoundState;
  /** Points of each player before this round. */
  points: Map<string, number>;
  warnings: RoundWarning[];
  /** False when a drop, undo or late join happened after the draft was generated. */
  seatsMatch: boolean;
}

export async function loadRoundsContext(event: EventRow): Promise<RoundsContext> {
  const [players, latestRow] = await Promise.all([
    listEventPlayers(event.id),
    getLatestRound(event.id),
  ]);
  const latest: LatestRound = latestRow
    ? { number: latestRow.number, status: latestRow.status }
    : null;
  const nextNumber = (latest?.number ?? 0) + 1;
  const gate = nextRoundGate({
    eventStatus: event.status,
    totalRounds: event.rounds,
    latest,
    activeForNext: activePlayerIds(players, nextNumber).length,
  });
  const canFinish = canFinishEvent({
    eventStatus: event.status,
    totalRounds: event.rounds,
    latest,
  });

  let current: CurrentRound | null = null;
  if (latest) {
    const [state, pastRounds] = await Promise.all([
      getRoundState(event.id, latest.number),
      getRoundRecords(event.id, latest.number - 1),
    ]);
    if (state) current = describeRound(event, players, state, pastRounds);
  }
  return { players, latest, current, gate, canFinish };
}

/** Points, warnings and the stale-draft check for one stored round. */
export function describeRound(
  event: EventRow,
  players: readonly EventPlayerRow[],
  state: RoundState,
  pastRounds: readonly RoundRecord[]
): CurrentRound {
  const records = state.tables.map((t) => t.record);
  const seated = records.flatMap((t) => t.seats.map((s) => s.playerId));
  const points = pointsBefore(seated, pastRounds, event.seed);
  return {
    state,
    points,
    warnings: roundWarnings(records, pastRounds, points),
    seatsMatch: seatsMatchPlayers(records, activePlayerIds(players, state.round.number)),
  };
}
