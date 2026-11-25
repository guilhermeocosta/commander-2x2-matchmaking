"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { planRound, swapPlayers } from "@/core/rounds";
import {
  finishEvent,
  getEventByCode,
  getRoundRecords,
  insertDraftRound,
  isUniqueViolation,
  newSeed,
  publishRound,
  replaceDraftTables,
} from "@/db/queries";
import type { EventRow } from "@/db/schema";
import { isAdmin, LOGIN_PATH } from "@/lib/auth";
import { audit, GENERIC_ERROR } from "@/lib/players";
import { loadRoundsContext, type RoundsContext } from "@/lib/rounds";

import { generateBlockMessage } from "./round-copy";

/** State shown by the round forms; `error` and `ok` are pt-BR copy. */
export interface RoundAdminState {
  error?: string;
  ok?: string;
}

const EVENT_NOT_FOUND = "Evento não encontrado.";
const NOT_A_DRAFT = "Essa rodada não é mais um rascunho. Recarregue a página.";
const STALE_PAGE = "A página está desatualizada. Recarregue e tente de novo.";

/** Every round action starts here: the session is checked on the server, then the event. */
async function adminEvent(code: string): Promise<EventRow | undefined> {
  if (!(await isAdmin())) redirect(LOGIN_PATH);
  return getEventByCode(code);
}

const roundSchema = z.object({ round: z.coerce.number().int().min(1).max(10) });

/** The round the form was rendered for; it must still be the latest one. */
function parseRound(formData: FormData): number | undefined {
  const parsed = roundSchema.safeParse({ round: formData.get("round") });
  return parsed.success ? parsed.data.round : undefined;
}

/** The latest round, when it is the draft numbered `round`. */
function draftOf(ctx: RoundsContext, round: number) {
  const current = ctx.current;
  if (!current || current.state.round.number !== round) return { error: STALE_PAGE };
  if (current.state.round.status !== "draft") return { error: NOT_A_DRAFT };
  return { draft: current };
}

/** Pairs round `round` with a fresh seed, from the rounds before it. */
async function plan(event: EventRow, ctx: RoundsContext, round: number) {
  const pastRounds = await getRoundRecords(event.id, round - 1);
  const seed = newSeed();
  const { tables } = planRound({
    players: ctx.players,
    pastRounds,
    round,
    tiebreakSeed: event.seed,
    seed,
  });
  return { tables, seed };
}

export async function generateRoundAction(
  code: string,
  _prev: RoundAdminState,
  formData: FormData
): Promise<RoundAdminState> {
  const event = await adminEvent(code);
  if (!event) return { error: EVENT_NOT_FOUND };
  const round = parseRound(formData);
  if (round === undefined) return { error: GENERIC_ERROR };

  try {
    const ctx = await loadRoundsContext(event);
    if (!ctx.gate.ok) return { error: generateBlockMessage(ctx.gate.block) };
    if (ctx.gate.round !== round) return { error: STALE_PAGE };
    const { tables, seed } = await plan(event, ctx, round);
    const roundId = await insertDraftRound({
      eventId: event.id,
      number: round,
      seed,
      durationSec: event.roundDurationSec,
      tables,
    });
    await audit({
      eventId: event.id,
      actor: "admin",
      action: "round_generated",
      payload: { roundId, round, seed },
    });
  } catch (error) {
    // Two clicks at once: the unique (event, number) lets only one round in.
    if (isUniqueViolation(error)) return { error: STALE_PAGE };
    return { error: GENERIC_ERROR };
  }
  refresh();
  return { ok: `Rodada ${round} gerada. Revise antes de publicar.` };
}

export async function rerollRoundAction(
  code: string,
  _prev: RoundAdminState,
  formData: FormData
): Promise<RoundAdminState> {
  const event = await adminEvent(code);
  if (!event) return { error: EVENT_NOT_FOUND };
  const round = parseRound(formData);
  if (round === undefined) return { error: GENERIC_ERROR };

  try {
    const ctx = await loadRoundsContext(event);
    const { draft, error } = draftOf(ctx, round);
    if (!draft) return { error };
    const { tables, seed } = await plan(event, ctx, round);
    await replaceDraftTables(draft.state.round.id, tables, seed);
    await audit({
      eventId: event.id,
      actor: "admin",
      action: "round_rerolled",
      payload: { roundId: draft.state.round.id, round, seed, previousSeed: draft.state.round.seed },
    });
  } catch (error) {
    if (error instanceof RangeError) {
      return { error: "Não há jogadores ativos suficientes para sortear esta rodada." };
    }
    if (isUniqueViolation(error)) return { error: NOT_A_DRAFT };
    return { error: GENERIC_ERROR };
  }
  refresh();
  return { ok: "Rodada sorteada de novo." };
}

const swapSchema = z
  .object({ playerA: z.uuid(), playerB: z.uuid() })
  .refine((v) => v.playerA !== v.playerB, "Escolha dois jogadores diferentes.");

export async function swapPlayersAction(
  code: string,
  _prev: RoundAdminState,
  formData: FormData
): Promise<RoundAdminState> {
  const event = await adminEvent(code);
  if (!event) return { error: EVENT_NOT_FOUND };
  const round = parseRound(formData);
  if (round === undefined) return { error: GENERIC_ERROR };
  const parsed = swapSchema.safeParse({
    playerA: formData.get("playerA"),
    playerB: formData.get("playerB"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues.find((i) => i.code === "custom");
    return { error: issue?.message ?? "Escolha os dois jogadores." };
  }
  const { playerA, playerB } = parsed.data;

  try {
    const ctx = await loadRoundsContext(event);
    const { draft, error } = draftOf(ctx, round);
    if (!draft) return { error };
    const records = draft.state.tables.map((t) => t.record);
    const seated = new Set(records.flatMap((t) => t.seats.map((s) => s.playerId)));
    if (!seated.has(playerA) || !seated.has(playerB)) {
      return { error: "Os dois jogadores precisam estar nesta rodada." };
    }
    await replaceDraftTables(draft.state.round.id, swapPlayers(records, playerA, playerB));
    await audit({
      eventId: event.id,
      actor: "admin",
      action: "round_players_swapped",
      payload: { roundId: draft.state.round.id, round, playerIds: [playerA, playerB] },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { error: NOT_A_DRAFT };
    return { error: GENERIC_ERROR };
  }
  refresh();
  return { ok: "Jogadores trocados." };
}

export async function publishRoundAction(
  code: string,
  _prev: RoundAdminState,
  formData: FormData
): Promise<RoundAdminState> {
  const event = await adminEvent(code);
  if (!event) return { error: EVENT_NOT_FOUND };
  const round = parseRound(formData);
  if (round === undefined) return { error: GENERIC_ERROR };

  try {
    const ctx = await loadRoundsContext(event);
    const { draft, error } = draftOf(ctx, round);
    if (!draft) return { error };
    if (!draft.seatsMatch) {
      return {
        error:
          "A lista de jogadores mudou depois do sorteio. Use “Sortear de novo” antes de publicar.",
      };
    }
    if (!(await publishRound(event.id, draft.state.round.id))) return { error: NOT_A_DRAFT };
    await audit({
      eventId: event.id,
      actor: "admin",
      action: "round_published",
      payload: { roundId: draft.state.round.id, round },
    });
  } catch {
    return { error: GENERIC_ERROR };
  }
  refresh();
  return { ok: `Rodada ${round} publicada.` };
}

export async function finishEventAction(code: string): Promise<RoundAdminState> {
  const event = await adminEvent(code);
  if (!event) return { error: EVENT_NOT_FOUND };
  try {
    const ctx = await loadRoundsContext(event);
    if (!ctx.canFinish) {
      return {
        error: `O evento só pode ser encerrado depois que a rodada ${event.rounds} fechar.`,
      };
    }
    if (!(await finishEvent(event.id))) return { error: STALE_PAGE };
    await audit({ eventId: event.id, actor: "admin", action: "event_finished", payload: {} });
  } catch {
    return { error: GENERIC_ERROR };
  }
  refresh();
  return { ok: "Evento encerrado." };
}
