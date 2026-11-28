import type { ResultStatus } from "@/core/report";
import type { GenerateBlock, RoundStatus, RoundWarning } from "@/core/rounds";
import { extraTurns } from "@/core/timer";
import type { OneVsOneGames, Outcome, Seat, TableKind, Team } from "@/core/types";

/** pt-BR copy for rounds, shared by the admin panel, the print page and the live views. */

export function generateBlockMessage(block: GenerateBlock): string {
  switch (block.kind) {
    case "event-finished":
      return "O evento está encerrado.";
    case "all-rounds-generated":
      return "Todas as rodadas do evento já foram geradas.";
    case "draft-pending":
      return `A rodada ${block.round} é um rascunho: publique ou sorteie de novo.`;
    case "previous-not-closed":
      return `A próxima rodada só pode ser gerada depois que a rodada ${block.round} fechar.`;
    case "too-few-players":
      return `São necessários pelo menos ${block.min} jogadores ativos (agora: ${block.active}).`;
  }
}

export function warningMessage(warning: RoundWarning, name: (id: string) => string): string {
  const [x] = warning.playerIds;
  switch (warning.kind) {
    case "extreme-teammates":
      return `${name(x)} e ${name(warning.playerIds[1])} formam dupla com 2 vitórias de diferença (2-0 com 0-2).`;
    case "second-bye":
      return `${name(x)} recebe bye pela segunda vez.`;
    case "second-1v1":
      return `${name(x)} joga 1v1 pela segunda vez.`;
    case "repeated-teammate":
      return `${name(x)} e ${name(warning.playerIds[1])} já jogaram em dupla.`;
    case "repeated-opponent":
      return `${name(x)} e ${name(warning.playerIds[1])} já se enfrentaram.`;
  }
}

export const roundStatusLabels: Record<RoundStatus, string> = {
  draft: "Rascunho",
  published: "Publicada",
  running: "Em andamento",
  paused: "Pausada",
  overtime: "Turnos extras",
  closed: "Fechada",
};

/** "A1", "B2"… */
export function seatLabel(seat: Pick<Seat, "team" | "position">): string {
  return `${seat.team}${seat.position}`;
}

/** Seats in turn order: A1, B1, A2, B2 (teammates in opposite corners). */
export function turnOrder<S extends Pick<Seat, "team" | "position">>(seats: readonly S[]): S[] {
  return [...seats].sort((a, b) => a.position - b.position || a.team.localeCompare(b.team));
}

export function tableTitle(kind: TableKind, number: number): string {
  if (kind === "bye") return "Bye";
  if (kind === "1v1") return `Mesa ${number} · 1v1`;
  return `Mesa ${number}`;
}

/** "0 pts", "1 pt", "3 pts". */
export function pointsLabel(points: number): string {
  return `${points} ${points === 1 ? "pt" : "pts"}`;
}

/** "Turno atual + 3 turnos extras" (2v2) or "+ 5" (1v1); null for a bye. */
export function overtimeMessage(kind: TableKind): string | null {
  const turns = extraTurns(kind);
  return turns === null ? null : `Turno atual + ${turns} turnos extras`;
}

export const resultStatusLabels: Record<ResultStatus, string> = {
  none: "Sem resultado",
  reported: "Reportado",
  overridden: "Alterado pelo admin",
};

export const resultStatusBadge: Record<ResultStatus, string> = {
  none: "badge-ghost",
  reported: "badge-success",
  overridden: "badge-warning",
};

/** "2–1". */
export function gamesLabel(games: OneVsOneGames): string {
  return `${games.a}–${games.b}`;
}

/**
 * A table's result in a few words: "Dupla A venceu", "Empate"; at the 1v1 the winner's name
 * (from `names`) and the games, e.g. "Eva venceu · 2–1".
 */
export function outcomeLabel(
  kind: TableKind,
  outcome: Outcome,
  games: OneVsOneGames | null = null,
  names?: Partial<Record<Team, string>>
): string {
  const score = games ? ` · ${gamesLabel(games)}` : "";
  if (outcome === "draw") return `Empate${score}`;
  if (kind === "1v1") return `${names?.[outcome] ?? `Jogador ${outcome}`} venceu${score}`;
  return `Dupla ${outcome} venceu`;
}
