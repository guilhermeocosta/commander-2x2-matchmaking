"use client";

import { useActionState, useState } from "react";

import type { LiveResult } from "@/core/event-state";
import type { SeatPosition, TableKind, Team } from "@/core/types";
import {
  outcomeLabel,
  resultStatusBadge,
  resultStatusLabels,
  seatLabel,
  tableTitle,
  turnOrder,
} from "@/lib/round-copy";

import {
  closeRoundAction,
  overrideResultAction,
  playerLeftAction,
  type RoundAdminState,
} from "./round-actions";

const initialState: RoundAdminState = {};
const teamBadge = { A: "badge-primary", B: "badge-info" } as const;

/** One table in the admin results grid. Player ids only reach the admin's own page. */
export interface ResultTableView {
  number: number;
  kind: TableKind;
  seats: { team: Team; position: SeatPosition; name: string; playerId: string }[];
  result: LiveResult | null;
}

function Feedback({ state }: { state: RoundAdminState }) {
  if (state.error) {
    return (
      <div role="alert" className="alert alert-error alert-soft text-sm">
        {state.error}
      </div>
    );
  }
  if (state.ok) {
    return (
      <div role="status" className="alert alert-success alert-soft text-sm">
        {state.ok}
      </div>
    );
  }
  return null;
}

/** Wraps an admin action so the live poll refetches right after it. */
function useAdminAction(
  action: (code: string, prev: RoundAdminState, formData: FormData) => Promise<RoundAdminState>,
  code: string,
  onDone?: () => Promise<void>
) {
  return useActionState(async (prev: RoundAdminState, formData: FormData) => {
    const next = await action(code, prev, formData);
    await onDone?.();
    return next;
  }, initialState);
}

/** Every table of one round with its result, reporter and the override controls. */
export function ResultsGrid({
  code,
  round,
  tables,
  onDone,
}: {
  code: string;
  round: number;
  tables: readonly ResultTableView[];
  onDone?: () => Promise<void>;
}) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2">
      {tables.map((table) => (
        <TableResultCard
          key={table.number}
          code={code}
          round={round}
          table={table}
          onDone={onDone}
        />
      ))}
    </ol>
  );
}

function teamNames(table: ResultTableView): Record<Team, string> {
  const of = (team: Team) =>
    table.seats
      .filter((s) => s.team === team)
      .map((s) => s.name)
      .join(" e ");
  return { A: of("A"), B: of("B") };
}

function TableResultCard({
  code,
  round,
  table,
  onDone,
}: {
  code: string;
  round: number;
  table: ResultTableView;
  onDone?: () => Promise<void>;
}) {
  const { result } = table;
  const names = teamNames(table);

  return (
    <li className="flex flex-col gap-2 rounded-box bg-base-100 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-bold">{tableTitle(table.kind, table.number)}</h4>
        {result && (
          <span className={`badge badge-sm ${resultStatusBadge[result.status]}`}>
            {resultStatusLabels[result.status]}
          </span>
        )}
      </div>

      {table.kind === "bye" ? (
        <p className="text-sm">
          {table.seats[0]?.name} <span className="text-base-content/60">· vitória automática</span>
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-1 text-sm">
            {(["A", "B"] as const).map((team) => (
              <li key={team} className="flex items-center gap-2">
                <span className={`badge badge-sm w-8 font-mono ${teamBadge[team]}`}>{team}</span>
                <span className="min-w-0 flex-1 truncate">{names[team]}</span>
              </li>
            ))}
          </ul>
          {result?.outcome ? (
            <p className="font-semibold">
              {outcomeLabel(table.kind, result.outcome, result.games, names)}
              {result.reportedBy && (
                <span className="block text-sm font-normal text-base-content/70">
                  Reportado por {result.reportedBy}
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-base-content/60">Aguardando o resultado</p>
          )}
          <details className="collapse-arrow collapse bg-base-200">
            <summary className="collapse-title min-h-0 py-2 text-sm font-medium">
              Alterar resultado
            </summary>
            <div className="collapse-content flex flex-col gap-4">
              <OverrideForm code={code} round={round} table={table} names={names} onDone={onDone} />
              <PlayerLeftForm code={code} round={round} table={table} onDone={onDone} />
            </div>
          </details>
        </>
      )}
    </li>
  );
}

function OverrideForm({
  code,
  round,
  table,
  names,
  onDone,
}: {
  code: string;
  round: number;
  table: ResultTableView;
  names: Record<Team, string>;
  onDone?: () => Promise<void>;
}) {
  const [state, formAction, pending] = useAdminAction(overrideResultAction, code, onDone);
  const games = table.result?.games;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="round" value={round} />
      <input type="hidden" name="table" value={table.number} />
      <input type="hidden" name="kind" value={table.kind} />
      {table.kind === "2v2" ? (
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["A", "A venceu", "btn-primary"],
              ["B", "B venceu", "btn-info"],
              ["draw", "Empate", "btn-secondary"],
            ] as const
          ).map(([value, label, color]) => (
            <button
              key={value}
              type="submit"
              name="outcome"
              value={value}
              disabled={pending}
              className={`btn btn-sm ${color} ${table.result?.outcome === value ? "" : "btn-soft"}`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <div key={`${games?.a}:${games?.b}`} className="flex flex-wrap items-end gap-2">
          {(["A", "B"] as const).map((team) => (
            <label key={team} className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
              <span className="truncate">Jogos de {names[team]}</span>
              <select
                name={team === "A" ? "gamesA" : "gamesB"}
                defaultValue={(team === "A" ? games?.a : games?.b) ?? 0}
                className="select select-sm w-full"
              >
                {[0, 1, 2].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button type="submit" className="btn btn-sm btn-primary" disabled={pending}>
            Salvar
          </button>
        </div>
      )}
      <Feedback state={state} />
    </form>
  );
}

function PlayerLeftForm({
  code,
  round,
  table,
  onDone,
}: {
  code: string;
  round: number;
  table: ResultTableView;
  onDone?: () => Promise<void>;
}) {
  const [leaver, setLeaver] = useState<string | null>(null);
  const [state, formAction, pending] = useAdminAction(playerLeftAction, code, async () => {
    setLeaver(null);
    await onDone?.();
  });
  const seat = table.seats.find((s) => s.playerId === leaver);

  return (
    <div className="flex flex-col gap-2 border-t border-base-300 pt-3">
      <p className="text-sm font-medium">Jogador saiu no meio do jogo</p>
      {seat ? (
        <form action={formAction} className="flex flex-col gap-2 rounded-box bg-base-300 p-3">
          <input type="hidden" name="round" value={round} />
          <input type="hidden" name="table" value={table.number} />
          <input type="hidden" name="playerId" value={seat.playerId} />
          <p className="text-sm">
            {seat.name} saiu: vitória {table.kind === "1v1" ? "do oponente" : "da outra dupla"}.
            Para tirá-lo das próximas rodadas, use “Gerenciar” em Jogadores.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-sm btn-warning" disabled={pending}>
              Confirmar
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={pending}
              onClick={() => setLeaver(null)}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {turnOrder(table.seats).map((s) => (
            <button
              key={s.playerId}
              type="button"
              className="btn btn-xs btn-outline"
              onClick={() => setLeaver(s.playerId)}
            >
              {seatLabel(s)} · {s.name}
            </button>
          ))}
        </div>
      )}
      <Feedback state={state} />
    </div>
  );
}

/** "Encerrar rodada" with a confirmation that warns about tables without a result. */
export function CloseRoundButton({
  code,
  round,
  missing,
  onDone,
}: {
  code: string;
  round: number;
  /** Numbers of the tables without a result. */
  missing: readonly number[];
  onDone?: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useAdminAction(closeRoundAction, code, async () => {
    setConfirming(false);
    await onDone?.();
  });

  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <form action={formAction} className="flex flex-col gap-3 rounded-box bg-base-300 p-4">
          <input type="hidden" name="round" value={round} />
          {missing.length > 0 ? (
            <div role="alert" className="alert alert-warning alert-soft text-sm">
              {missing.length === 1
                ? `A mesa ${missing[0]} está sem resultado. Ela fica sem resultado (não conta para ninguém) até você definir um.`
                : `As mesas ${missing.join(", ")} estão sem resultado. Elas ficam sem resultado (não contam para ninguém) até você definir.`}
            </div>
          ) : (
            <p className="text-sm">Todas as mesas têm resultado.</p>
          )}
          <p>Encerrar a rodada {round}? Depois disso só a organização altera resultados.</p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending && <span className="loading loading-spinner loading-sm" />}
              {missing.length > 0 ? "Encerrar mesmo assim" : "Sim, encerrar"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => setConfirming(true)}>
          Encerrar rodada {round}
          {missing.length > 0 && (
            <span className="badge badge-sm badge-warning">{missing.length} sem resultado</span>
          )}
        </button>
      )}
      <Feedback state={state} />
    </div>
  );
}
