import "server-only";

import { canStillPlay, isEventFull, joinRound, MAX_PLAYERS_PER_EVENT } from "@/core/players";
import type { RosterEntry } from "@/core/roster";
import {
  addEventPlayer,
  countEventPlayers,
  getLatestRoundNumber,
  isUniqueViolation,
  writeAudit,
  type AuditEntryInput,
} from "@/db/queries";
import type { EventPlayerRow, EventRow } from "@/db/schema";

/**
 * Player operations shared by the join page and the admin panel. Callers validate input and
 * check who is acting; these enforce the event rules and return pt-BR errors for the UI.
 */

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const JOIN_CLOSED = "As inscrições deste evento estão encerradas.";
export const NO_ROUNDS_LEFT = "Todas as rodadas já foram pareadas; não dá mais para entrar.";
export const ROSTER_TAKEN = "Esse jogador já está inscrito neste evento.";
export const ROSTER_UNKNOWN = "Nome não encontrado na lista de jogadores.";
export const EVENT_FULL = `O evento já tem ${MAX_PLAYERS_PER_EVENT} jogadores, o limite.`;
export const GENERIC_ERROR = "Algo deu errado. Tente de novo.";

/** Joining (or being added) is open while the event is `open` or `running`. */
export function isJoinable(event: EventRow): boolean {
  return event.status !== "finished";
}

export function findRosterEntry(roster: RosterEntry[], id: string): RosterEntry | undefined {
  return roster.find((entry) => entry.id === id);
}

/**
 * Adds a player, entering the next round that hasn't been paired yet (late join). Fails when
 * the event is finished or full, every round is already paired, or the roster id is taken.
 * The cap is checked before the insert, not in the same statement: two joins at the same
 * instant could both pass at 39 players. That's acceptable for a spam guard.
 */
export async function addPlayer(
  event: EventRow,
  input: { displayName: string; rosterId: string | null; deviceTokenHash: string | null }
): Promise<Result<EventPlayerRow>> {
  if (!isJoinable(event)) return { ok: false, error: JOIN_CLOSED };
  try {
    const [latest, players] = await Promise.all([
      getLatestRoundNumber(event.id),
      countEventPlayers(event.id),
    ]);
    if (isEventFull(players)) return { ok: false, error: EVENT_FULL };
    if (!canStillPlay(latest, event.rounds)) return { ok: false, error: NO_ROUNDS_LEFT };
    const player = await addEventPlayer({
      eventId: event.id,
      ...input,
      joinedRound: joinRound(latest),
    });
    return { ok: true, value: player };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: ROSTER_TAKEN };
    return { ok: false, error: GENERIC_ERROR };
  }
}

/**
 * Appends an audit entry. A failed audit write must not undo or repeat a change that already
 * happened, so it's swallowed. Payloads hold ids only: no names, tokens or other personal data.
 */
export async function audit(entry: AuditEntryInput): Promise<void> {
  try {
    await writeAudit(entry);
  } catch {
    // See above.
  }
}
