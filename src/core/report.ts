/**
 * Result reporting rules (P09): what a report stores, who may report a table, when a round can
 * be closed, and a table's result status. Pure: the caller loads and stores the data.
 */
import { z } from "zod";

import { oneVsOneOutcome } from "./results.ts";
import type { RoundStatus } from "./rounds.ts";
import type { Outcome, PlayerId, TableKind, Team } from "./types.ts";

/** What a player or the admin submits for one table. */
export type ResultInput =
  { kind: "2v2"; outcome: Outcome } | { kind: "1v1"; gamesA: number; gamesB: number };

const gamesField = z.coerce.number().int().min(0).max(2);

/**
 * A result form (player report or admin override): the round and table it was rendered for,
 * and the result. Parse browser input with it on the server.
 */
export const resultFormSchema = z.intersection(
  z.object({
    round: z.coerce.number().int().min(1).max(10),
    table: z.coerce.number().int().min(1).max(100),
  }),
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("2v2"), outcome: z.enum(["A", "B", "draw"]) }),
    z
      .object({ kind: z.literal("1v1"), gamesA: gamesField, gamesB: gamesField })
      .refine((v) => !(v.gamesA === 2 && v.gamesB === 2), "1v1 is best of 3"),
  ])
);

/** The raw fields of a result form, for {@link resultFormSchema}. */
export function resultFormFields(formData: FormData) {
  return {
    round: formData.get("round"),
    table: formData.get("table"),
    kind: formData.get("kind"),
    outcome: formData.get("outcome") ?? undefined,
    gamesA: formData.get("gamesA") ?? undefined,
    gamesB: formData.get("gamesB") ?? undefined,
  };
}

/** The columns a result writes. `games` only for a 1v1 table. */
export interface StoredResult {
  outcome: Outcome;
  gamesA: number | null;
  gamesB: number | null;
}

/**
 * The stored form of a result. A 1v1 stores the games and the outcome derived from them with
 * {@link oneVsOneOutcome} (1-1 and 0-0 are draws). Throws a RangeError on invalid 1v1 games.
 */
export function resolveResult(input: ResultInput): StoredResult {
  if (input.kind === "2v2") return { outcome: input.outcome, gamesA: null, gamesB: null };
  return {
    outcome: oneVsOneOutcome(input.gamesA, input.gamesB),
    gamesA: input.gamesA,
    gamesB: input.gamesB,
  };
}

/**
 * "Jogador saiu no meio do jogo": the team of the player who left loses. For a 1v1 the games
 * are cleared, since the match result no longer comes from them.
 */
export function leftMidGameResult(leaverTeam: Team): StoredResult {
  return { outcome: leaverTeam === "A" ? "B" : "A", gamesA: null, gamesB: null };
}

/** Rounds whose tables take results from players (published and not closed yet). */
export const OPEN_ROUND_STATUSES = ["published", "running", "paused", "overtime"] as const;

export function isRoundOpen(status: RoundStatus): boolean {
  return (OPEN_ROUND_STATUSES as readonly RoundStatus[]).includes(status);
}

/** The admin can set results on any round past `draft`, closed ones included. */
export function canOverride(status: RoundStatus): boolean {
  return status !== "draft";
}

/** Why a player's report is refused. */
export type ReportBlock = "round-not-open" | "not-seated" | "bye" | "overridden" | "wrong-kind";

/** The minimum a report check needs to know about a table. */
export interface ReportTable {
  number: number;
  kind: TableKind;
  seats: readonly { playerId: PlayerId }[];
  overridden: boolean;
}

/**
 * Whether `playerId` may report `input` for table `tableNumber` of a round. Only a player seated
 * at that very table may, while the round is open, and not after the admin set the result.
 */
export function reportPermission(input: {
  roundStatus: RoundStatus;
  tables: readonly ReportTable[];
  tableNumber: number;
  playerId: PlayerId;
  kind: ResultInput["kind"];
}): { ok: true } | { ok: false; block: ReportBlock } {
  const { roundStatus, tables, tableNumber, playerId, kind } = input;
  if (!isRoundOpen(roundStatus)) return { ok: false, block: "round-not-open" };
  const table = tables.find((t) => t.number === tableNumber);
  if (!table || !table.seats.some((s) => s.playerId === playerId)) {
    return { ok: false, block: "not-seated" };
  }
  if (table.kind === "bye") return { ok: false, block: "bye" };
  if (table.kind !== kind) return { ok: false, block: "wrong-kind" };
  if (table.overridden) return { ok: false, block: "overridden" };
  return { ok: true };
}

/** Sem resultado, reportado (by a player) or alterado pelo admin. A bye has no status. */
export type ResultStatus = "none" | "reported" | "overridden";

export function resultStatus(table: {
  outcome: Outcome | null;
  overridden: boolean;
}): ResultStatus {
  if (table.overridden) return "overridden";
  return table.outcome === null ? "none" : "reported";
}

/** Tables of a round still without a result (byes never need one). */
export function tablesMissingResults<T extends { kind: TableKind; outcome: Outcome | null }>(
  tables: readonly T[]
): T[] {
  return tables.filter((t) => t.kind !== "bye" && t.outcome === null);
}
