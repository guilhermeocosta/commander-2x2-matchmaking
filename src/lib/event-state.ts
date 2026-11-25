import "server-only";

import { buildEventState, type EventState } from "@/core/event-state";
import { liveStatus } from "@/core/timer";
import { getLiveRound, markRoundOvertime } from "@/db/queries";
import type { EventRow } from "@/db/schema";

import { getCurrentPlayer } from "./player-session";
import { audit } from "./players";

/**
 * The live snapshot for `event` as seen by this request's device cookie. Used by the state
 * route and for the first render of the live pages, so both agree.
 *
 * When the time of a `running` round is up, the stored status moves to `overtime` here (once:
 * the update is conditional), since no admin action marks that moment.
 */
export async function loadEventState(event: EventRow): Promise<EventState> {
  const [round, player] = await Promise.all([getLiveRound(event.id), getCurrentPlayer(event)]);
  const now = Date.now();

  if (round && round.status === "running" && liveStatus(round, now) === "overtime") {
    try {
      if (await markRoundOvertime(round.id, round)) {
        await audit({
          eventId: event.id,
          actor: "system",
          action: "round_overtime_started",
          payload: { roundId: round.id, round: round.number },
        });
      }
    } catch {
      // The snapshot already reads overtime from the clock; the stored status can catch up later.
    }
  }

  return buildEventState({
    now,
    event: { code: event.code, name: event.name, status: event.status, rounds: event.rounds },
    round: round ?? null,
    me: player ?? null,
  });
}
