"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  canOverride,
  isRoundOpen,
  leftMidGameResult,
  resolveResult,
  resultFormFields,
  resultFormSchema,
  tablesMissingResults,
  type StoredResult,
} from "@/core/report";
import { planRound, swapPlayers } from "@/core/rounds";
import { applyTimerAction, elapsedMs, type TimerAction } from "@/core/timer";
import {
  closeRound,
  finishEvent,
  getEventByCode,
  getLatestRound,
  getRoundRecords,
  getRoundState,
  insertDraftRound,
  isUniqueViolation,
  newSeed,
  overrideTableResult,
  publishRound,
  replaceDraftTables,
  toTimerFields,
  updateRoundTimer,
  type RoundTable,
} from "@/db/queries";
import type { EventRow } from "@/db/schema";
import { isAdmin, LOGIN_PATH } from "@/lib/auth";
import { audit, GENERIC_ERROR } from "@/lib/players";
import { loadRoundsContext, type RoundsContext } from "@/lib/rounds";

import { generateBlockMessage } from "@/lib/round-copy";

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

const timerSchema = z.object({
  round: roundSchema.shape.round,
  action: z.enum(["start", "pause", "resume", "add5"]),
});

const timerAudit: Record<TimerAction, string> = {
  start: "round_timer_started",
  pause: "round_timer_paused",
  resume: "round_timer_resumed",
  add5: "round_time_added",
};

/** Iniciar, Pausar, Retomar and +5 min for the latest round. */
export async function roundTimerAction(
  code: string,
  _prev: RoundAdminState,
  formData: FormData
): Promise<RoundAdminState> {
  const event = await adminEvent(code);
  if (!event) return { error: EVENT_NOT_FOUND };
  const parsed = timerSchema.safeParse({
    round: formData.get("round"),
    action: formData.get("action"),
  });
  if (!parsed.success) return { error: GENERIC_ERROR };
  const { round, action } = parsed.data;

  try {
    const row = await getLatestRound(event.id);
    if (!row || row.number !== round) return { error: STALE_PAGE };
    const prev = toTimerFields(row);
    const now = Date.now();
    const change = applyTimerAction(prev, action, now);
    if (!change.ok)
      return { error: "Essa ação não vale para a rodada agora. Recarregue a página." };
    // Another click (or tab) changed the clock first: nothing is written.
    if (!(await updateRoundTimer(row.id, prev, change.next))) return { error: STALE_PAGE };
    await audit({
      eventId: event.id,
      actor: "admin",
      action: timerAudit[action],
      payload: {
        roundId: row.id,
        round,
        status: change.next.status,
        elapsedSec: Math.floor(elapsedMs(change.next, now) / 1000),
        durationSec: change.next.durationSec,
      },
    });
  } catch {
    return { error: GENERIC_ERROR };
  }
  refresh();
  return {};
}

// ---------------------------------------------------------------------------------------------
// Results and closing

const NO_RESULT_HERE = "Essa mesa não aceita resultado. Recarregue a página.";

/** Writes an admin result for one table of `round` and audits it. */
async function setResult(
  event: EventRow,
  round: number,
  tableNumber: number,
  check: (
    table: RoundTable
  ) => { result: StoredResult; payload: Record<string, unknown> } | { error: string },
  action: string
): Promise<RoundAdminState | undefined> {
  const state = await getRoundState(event.id, round);
  if (!state || !canOverride(state.round.status)) return { error: STALE_PAGE };
  const table = state.tables.find((t) => t.row.number === tableNumber);
  if (!table || table.row.kind === "bye") return { error: NO_RESULT_HERE };
  const checked = check(table);
  if ("error" in checked) return { error: checked.error };
  const ok = await overrideTableResult({
    eventId: event.id,
    roundId: state.round.id,
    tableNumber,
    result: checked.result,
  });
  if (!ok) return { error: STALE_PAGE };
  await audit({
    eventId: event.id,
    actor: "admin",
    action,
    payload: {
      roundId: state.round.id,
      round,
      table: tableNumber,
      ...checked.result,
      ...checked.payload,
      previousOutcome: table.row.outcome,
      previousReportedBy: table.row.reportedBy,
    },
  });
  return undefined;
}

/** The admin sets (or fixes) a table's result, on an open or closed round. */
export async function overrideResultAction(
  code: string,
  _prev: RoundAdminState,
  formData: FormData
): Promise<RoundAdminState> {
  const event = await adminEvent(code);
  if (!event) return { error: EVENT_NOT_FOUND };
  const parsed = resultFormSchema.safeParse(resultFormFields(formData));
  if (!parsed.success) return { error: "Escolha um resultado válido." };
  const input = parsed.data;

  try {
    const failed = await setResult(
      event,
      input.round,
      input.table,
      (table) =>
        table.row.kind === input.kind
          ? { result: resolveResult(input), payload: {} }
          : { error: STALE_PAGE },
      "result_overridden"
    );
    if (failed) return failed;
  } catch {
    return { error: GENERIC_ERROR };
  }
  refresh();
  return { ok: `Resultado da mesa ${input.table} alterado.` };
}

const playerLeftSchema = z.object({
  round: roundSchema.shape.round,
  table: z.coerce.number().int().min(1).max(100),
  playerId: z.uuid(),
});

/** "Jogador saiu no meio do jogo": the leaver's team loses that table. */
export async function playerLeftAction(
  code: string,
  _prev: RoundAdminState,
  formData: FormData
): Promise<RoundAdminState> {
  const event = await adminEvent(code);
  if (!event) return { error: EVENT_NOT_FOUND };
  const parsed = playerLeftSchema.safeParse({
    round: formData.get("round"),
    table: formData.get("table"),
    playerId: formData.get("playerId"),
  });
  if (!parsed.success) return { error: "Escolha quem saiu." };
  const { round, table: tableNumber, playerId } = parsed.data;

  try {
    const failed = await setResult(
      event,
      round,
      tableNumber,
      (table) => {
        const seat = table.record.seats.find((s) => s.playerId === playerId);
        if (!seat) return { error: "Esse jogador não está nesta mesa." };
        return { result: leftMidGameResult(seat.team), payload: { leftPlayerId: playerId } };
      },
      "result_player_left"
    );
    if (failed) return failed;
  } catch {
    return { error: GENERIC_ERROR };
  }
  refresh();
  return { ok: `Mesa ${tableNumber}: vitória da outra dupla registrada.` };
}

/** "Encerrar rodada": closes the latest round, even with tables still missing a result. */
export async function closeRoundAction(
  code: string,
  _prev: RoundAdminState,
  formData: FormData
): Promise<RoundAdminState> {
  const event = await adminEvent(code);
  if (!event) return { error: EVENT_NOT_FOUND };
  const round = parseRound(formData);
  if (round === undefined) return { error: GENERIC_ERROR };

  try {
    const state = await getRoundState(event.id, round);
    const latest = await getLatestRound(event.id);
    if (!state || latest?.id !== state.round.id || !isRoundOpen(state.round.status)) {
      return { error: STALE_PAGE };
    }
    const missing = tablesMissingResults(state.tables.map((t) => t.row)).map((t) => t.number);
    if (!(await closeRound(event.id, state.round.id))) return { error: STALE_PAGE };
    await audit({
      eventId: event.id,
      actor: "admin",
      action: "round_closed",
      payload: { roundId: state.round.id, round, tablesWithoutResult: missing },
    });
  } catch {
    return { error: GENERIC_ERROR };
  }
  refresh();
  return {
    ok:
      round < event.rounds
        ? `Rodada ${round} encerrada. Já dá para gerar a rodada ${round + 1}.`
        : `Rodada ${round} encerrada. Já dá para encerrar o evento.`,
  };
}
