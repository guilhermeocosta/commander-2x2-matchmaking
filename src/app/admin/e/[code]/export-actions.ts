"use server";

import { redirect } from "next/navigation";
import { z, ZodError } from "zod";

import {
  applyEventToLeaderboard,
  decklistsToCollect,
  eventResults,
  formatLeaderboard,
  type NewPlayer,
} from "@/core/export";
import { getEventByCode, getRoundRecords, listEventPlayers } from "@/db/queries";
import { isAdmin, LOGIN_PATH } from "@/lib/auth";
import { GENERIC_ERROR } from "@/lib/players";
import { downloadLeaderboard } from "@/lib/roster";

export interface ExportDecklist {
  name: string;
  wins: number;
  draws: number;
  losses: number;
}

export interface ExportData {
  /** The new `leaderboard.json`, formatted like the site's Prettier. */
  json: string;
  /** `updatedAt` of the file fetched from the site, as YYYY-MM-DD. */
  sourceUpdatedAt: string;
  updatedCount: number;
  newPlayers: NewPlayer[];
  decklists: ExportDecklist[];
}

/** State of the export form; `error` is pt-BR copy. */
export interface ExportState {
  error?: string;
  data?: ExportData;
}

const codeSchema = z.object({ code: z.string().max(10) });

const NOT_FINISHED = "A exportação fica disponível quando o evento for encerrado.";
const FETCH_FAILED =
  "Não foi possível baixar o leaderboard.json do site. Tente de novo em alguns minutos.";
const SCHEMA_CHANGED =
  "O leaderboard.json do site não tem o formato esperado (o site mudou?). Nada foi gerado.";

/** Builds the updated season file from the finished event. Reads only; writes nothing. */
export async function exportLeaderboardAction(
  _prev: ExportState,
  formData: FormData
): Promise<ExportState> {
  if (!(await isAdmin())) redirect(LOGIN_PATH);
  const parsed = codeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: "Evento não encontrado." };
  const event = await getEventByCode(parsed.data.code);
  if (!event) return { error: "Evento não encontrado." };
  if (event.status !== "finished") return { error: NOT_FINISHED };

  let file: unknown;
  try {
    file = await downloadLeaderboard();
  } catch {
    return { error: FETCH_FAILED };
  }

  const [players, rounds] = await Promise.all([
    listEventPlayers(event.id),
    getRoundRecords(event.id),
  ]);
  const results = eventResults(players, rounds, event.rounds);

  let exported: ReturnType<typeof applyEventToLeaderboard>;
  try {
    exported = applyEventToLeaderboard(file, results, event.date);
  } catch (error) {
    return { error: error instanceof ZodError ? SCHEMA_CHANGED : GENERIC_ERROR };
  }

  return {
    data: {
      json: formatLeaderboard(exported.leaderboard),
      sourceUpdatedAt: (file as { updatedAt: string }).updatedAt,
      updatedCount: results.length - exported.newPlayers.length,
      newPlayers: exported.newPlayers,
      decklists: decklistsToCollect(results).map(({ name, wins, draws, losses }) => ({
        name,
        wins,
        draws,
        losses,
      })),
    },
  };
}
