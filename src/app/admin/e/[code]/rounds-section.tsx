import Link from "next/link";

import { resultStatus } from "@/core/report";
import { getRoundState, type RoundState } from "@/db/queries";
import type { EventRow } from "@/db/schema";
import { loadEventState } from "@/lib/event-state";
import { loadRoundsContext, type CurrentRound } from "@/lib/rounds";

import {
  generateBlockMessage,
  roundStatusLabels,
  seatLabel,
  tableTitle,
  turnOrder,
  warningMessage,
} from "@/lib/round-copy";
import { LiveRoundAdmin } from "./live-round-admin";
import { ResultsGrid, type ResultTableView } from "./results-admin";
import { RoundTables, type TableView } from "./round-tables";
import {
  DraftActions,
  FinishEventButton,
  GenerateRoundButton,
  SwapForm,
  type SwapOption,
} from "./rounds-admin";

/** Display names by player id. Unknown ids (never expected) show a placeholder. */
export function nameLookup(players: readonly { id: string; displayName: string }[]) {
  const names = new Map(players.map((p) => [p.id, p.displayName]));
  return (id: string) => names.get(id) ?? "Jogador removido";
}

/** The tables of a stored round, with names and points resolved for display. */
export function tableViews(current: CurrentRound, name: (id: string) => string): TableView[] {
  return current.state.tables.map(({ row, record }) => ({
    number: row.number,
    kind: row.kind,
    seats: record.seats.map((s) => ({
      ...s,
      name: name(s.playerId),
      points: current.points.get(s.playerId) ?? 0,
    })),
  }));
}

/** A stored round's tables for the admin results grid, reporter names resolved. */
export function resultTableViews(
  state: RoundState,
  name: (id: string) => string
): ResultTableView[] {
  return state.tables.map(({ row, record }) => ({
    number: row.number,
    kind: row.kind,
    seats: record.seats.map((s) => ({ ...s, name: name(s.playerId) })),
    result:
      row.kind === "bye"
        ? null
        : {
            status: resultStatus(row),
            outcome: row.outcome,
            games: record.games ?? null,
            reportedBy: row.reportedBy ? name(row.reportedBy) : null,
          },
  }));
}

/** "table:A1" → player id, for the live grid (the public snapshot carries names only). */
function seatIdMap(state: RoundState): Record<string, string> {
  return Object.fromEntries(
    state.tables.flatMap(({ row, record }) =>
      record.seats.map((s) => [`${row.number}:${seatLabel(s)}`, s.playerId])
    )
  );
}

/** The "Rodadas" section of the admin event panel. Rendered only after `requireAdmin()`. */
export async function RoundsSection({ event }: { event: EventRow }) {
  const [ctx, live] = await Promise.all([loadRoundsContext(event), loadEventState(event)]);
  const name = nameLookup(ctx.players);
  const { current, gate } = ctx;
  const round = current?.state.round;
  const isDraft = round?.status === "draft";
  // Earlier rounds, all closed by then: their results can still be fixed.
  const earlier = (
    await Promise.all(
      Array.from({ length: Math.max(0, (round?.number ?? 1) - 1) }, (_, i) =>
        getRoundState(event.id, i + 1)
      )
    )
  ).filter((s): s is RoundState => s !== undefined && s.round.status !== "draft");

  // Hide the button when it can never apply (draft under review, last round done, finished).
  const showGenerate =
    gate.ok ||
    (gate.block.kind !== "draft-pending" &&
      gate.block.kind !== "all-rounds-generated" &&
      gate.block.kind !== "event-finished");

  const finishHint =
    event.status === "finished" || ctx.canFinish
      ? null
      : `Disponível depois que a rodada ${event.rounds} fechar.`;

  return (
    <section id="rodadas" className="card bg-base-200">
      <div className="card-body gap-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="card-title">Rodadas</h2>
          <span className="text-sm text-base-content/70">
            {ctx.latest
              ? `Rodada ${ctx.latest.number} de ${event.rounds}`
              : `${event.rounds} rodadas`}
          </span>
        </div>

        {current && round && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold">Rodada {round.number}</h3>
              <span className={`badge badge-sm ${isDraft ? "badge-warning" : "badge-success"}`}>
                {roundStatusLabels[round.status]}
              </span>
              <Link
                href={`/e/${event.code}/display`}
                className="btn btn-ghost btn-sm ml-auto"
                target="_blank"
              >
                Telão
              </Link>
              <Link
                href={`/admin/e/${event.code}/print/${round.number}`}
                className="btn btn-ghost btn-sm"
              >
                Imprimir
              </Link>
            </div>

            {isDraft && (
              <p className="text-sm text-base-content/70">
                Os jogadores ainda não veem esta rodada. Revise as mesas e publique.
              </p>
            )}

            {isDraft && !current.seatsMatch && (
              <div role="alert" className="alert alert-warning alert-soft text-sm">
                A lista de jogadores mudou depois do sorteio (alguém entrou ou desistiu). Use
                “Sortear de novo” antes de publicar.
              </div>
            )}

            {current.warnings.length > 0 && (
              <div role="status" className="alert alert-warning alert-soft text-sm">
                <div>
                  <p className="font-bold">Avisos do pareamento</p>
                  <ul className="list-disc pl-5">
                    {current.warnings.map((w, i) => (
                      <li key={i}>{warningMessage(w, name)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {!isDraft && live.round?.number === round.number ? (
              <LiveRoundAdmin code={event.code} initial={live} seatIds={seatIdMap(current.state)} />
            ) : (
              <RoundTables tables={tableViews(current, name)} />
            )}

            {isDraft && (
              <>
                <DraftActions
                  code={event.code}
                  round={round.number}
                  canPublish={current.seatsMatch}
                />
                <details className="collapse-arrow collapse bg-base-100">
                  <summary className="collapse-title font-medium">Trocar jogadores</summary>
                  <div className="collapse-content">
                    <p className="pb-3 text-sm text-base-content/70">
                      Os dois trocam de lugar, inclusive com o 1v1 ou o bye. Os avisos são
                      recalculados.
                    </p>
                    <SwapForm
                      code={event.code}
                      round={round.number}
                      options={swapOptions(current, name)}
                    />
                  </div>
                </details>
              </>
            )}
          </div>
        )}

        {showGenerate && (
          <GenerateRoundButton
            code={event.code}
            round={gate.round}
            disabledReason={gate.ok ? null : generateBlockMessage(gate.block)}
          />
        )}

        <FinishEventButton code={event.code} enabled={ctx.canFinish} hint={finishHint} />

        {earlier.length > 0 && (
          <div className="flex flex-col gap-2">
            {[...earlier].reverse().map((state) => (
              <details key={state.round.id} className="collapse-arrow collapse bg-base-100">
                <summary className="collapse-title font-medium">
                  Resultados da rodada {state.round.number}
                </summary>
                <div className="collapse-content">
                  <ResultsGrid
                    code={event.code}
                    round={state.round.number}
                    tables={resultTableViews(state, name)}
                  />
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function swapOptions(current: CurrentRound, name: (id: string) => string): SwapOption[] {
  return current.state.tables.flatMap(({ row, record }) =>
    turnOrder(record.seats).map((s) => ({
      playerId: s.playerId,
      label:
        row.kind === "bye"
          ? `Bye · ${name(s.playerId)}`
          : `${tableTitle(row.kind, row.number)} · ${seatLabel(s)} · ${name(s.playerId)}`,
    }))
  );
}
