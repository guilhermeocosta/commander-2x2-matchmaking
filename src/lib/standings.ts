import "server-only";

import { eventStandings, type EventStandings } from "@/core/event-standings";
import { getLastClosedRoundNumber, getRoundRecords, listEventPlayers } from "@/db/queries";
import type { EventRow } from "@/db/schema";

/**
 * The event standings after the last closed round, or null before round 1 closes. Shared by the
 * standings route, the player and display pages and the admin panel, so they all agree.
 */
export async function loadStandings(event: EventRow): Promise<EventStandings | null> {
  const throughRound = await getLastClosedRoundNumber(event.id);
  if (throughRound === 0) return null;
  const [players, rounds] = await Promise.all([
    listEventPlayers(event.id),
    getRoundRecords(event.id, throughRound),
  ]);
  return eventStandings({ players, rounds, seed: event.seed, throughRound });
}
