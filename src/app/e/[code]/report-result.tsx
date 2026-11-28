"use client";

import { useActionState, useState } from "react";

import type { LiveTable } from "@/core/event-state";
import { resolveResult } from "@/core/report";
import type { Outcome, Team } from "@/core/types";
import { outcomeLabel } from "@/lib/round-copy";

import { reportResultAction, type PlayerFormState } from "./actions";

const initialState: PlayerFormState = {};

/**
 * The result box under the player's seat: the current result, and while the round is open the
 * report buttons (2v2: one tap; 1v1: games per player, then send). The server checks the seat.
 */
export function ReportResult({
  code,
  round,
  table,
  myTeam,
  open,
  onDone,
}: {
  code: string;
  round: number;
  table: LiveTable;
  myTeam: Team;
  /** False once the round is closed. */
  open: boolean;
  onDone: () => Promise<void>;
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: PlayerFormState, formData: FormData) => {
      const next = await reportResultAction(code, prev, formData);
      await onDone();
      return next;
    },
    initialState
  );
  const result = table.result;
  if (!result) return null;

  const names = teamNames(table);
  const current =
    result.outcome === null ? null : outcomeLabel(table.kind, result.outcome, result.games, names);
  const locked = !open || result.status === "overridden";

  return (
    <div className="flex flex-col gap-3 rounded-box bg-base-100 p-4">
      <h3 className="font-bold">Resultado da mesa</h3>
      <div
        role="status"
        className={`rounded-box p-3 text-center ${current ? "bg-success/15" : "bg-base-200"}`}
      >
        {current ? (
          <>
            <p className="text-xl font-bold">{current}</p>
            <p className="text-sm text-base-content/70">
              {result.status === "overridden"
                ? "Definido pela organização"
                : result.reportedBy
                  ? `Reportado por ${result.reportedBy}`
                  : "Reportado"}
            </p>
          </>
        ) : (
          <p className="text-base-content/70">Ainda sem resultado.</p>
        )}
      </div>

      {state.error && (
        <div role="alert" className="alert alert-error alert-soft">
          {state.error}
        </div>
      )}
      {state.ok && !state.error && (
        <div role="status" className="alert alert-success alert-soft">
          {state.ok} {open && "Dá para mudar até a rodada fechar."}
        </div>
      )}

      {locked ? (
        <p className="text-sm text-base-content/70">
          {open
            ? "Para mudar, fale com a organização."
            : "A rodada fechou. Para mudar, fale com a organização."}
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="round" value={round} />
          <input type="hidden" name="table" value={table.number} />
          <input type="hidden" name="kind" value={table.kind} />
          {table.kind === "2v2" ? (
            <TwoVsTwoButtons
              names={names}
              myTeam={myTeam}
              current={result.outcome}
              pending={pending}
            />
          ) : (
            <OneVsOneForm
              key={`${result.games?.a ?? "-"}:${result.games?.b ?? "-"}`}
              names={names}
              initial={result.games}
              pending={pending}
            />
          )}
        </form>
      )}
    </div>
  );
}

/** "Ana e Bia" per team; the single name at the 1v1. */
function teamNames(table: LiveTable): Record<Team, string> {
  const of = (team: Team) =>
    table.seats
      .filter((s) => s.team === team)
      .map((s) => s.name)
      .join(" e ");
  return { A: of("A"), B: of("B") };
}

function TwoVsTwoButtons({
  names,
  myTeam,
  current,
  pending,
}: {
  names: Record<Team, string>;
  myTeam: Team;
  current: Outcome | null;
  pending: boolean;
}) {
  const options: { value: Outcome; label: string; sub: string; color: string }[] = [
    {
      value: "A",
      label: "Dupla A venceu",
      sub: `${names.A}${myTeam === "A" ? " (sua dupla)" : ""}`,
      color: "btn-primary",
    },
    {
      value: "B",
      label: "Dupla B venceu",
      sub: `${names.B}${myTeam === "B" ? " (sua dupla)" : ""}`,
      color: "btn-info",
    },
    { value: "draw", label: "Empate", sub: "Fim dos turnos extras", color: "btn-secondary" },
  ];
  return (
    <div className="flex flex-col gap-2">
      {options.map((o) => {
        const selected = current === o.value;
        return (
          <button
            key={o.value}
            type="submit"
            name="outcome"
            value={o.value}
            disabled={pending}
            aria-pressed={selected}
            className={`btn h-auto min-h-16 flex-col gap-0 py-2 btn-lg ${o.color} ${
              selected ? "" : "btn-soft"
            }`}
          >
            <span className="text-lg">
              {selected && "✓ "}
              {o.label}
            </span>
            <span className="text-sm font-normal break-words whitespace-normal opacity-80">
              {o.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function OneVsOneForm({
  names,
  initial,
  pending,
}: {
  names: Record<Team, string>;
  initial: { a: number; b: number } | null;
  pending: boolean;
}) {
  const [a, setA] = useState<number | null>(initial?.a ?? null);
  const [b, setB] = useState<number | null>(initial?.b ?? null);
  const valid = a !== null && b !== null && !(a === 2 && b === 2);
  const preview = valid
    ? outcomeLabel(
        "1v1",
        resolveResult({ kind: "1v1", gamesA: a, gamesB: b }).outcome,
        {
          a,
          b,
        },
        names
      )
    : null;

  const row = (team: Team, value: number | null, set: (v: number) => void) => (
    <fieldset className="flex flex-col gap-1">
      <legend className="pb-1 text-sm">
        Jogos vencidos por <strong className="break-words">{names[team]}</strong>
      </legend>
      <div className="join w-full">
        {[0, 1, 2].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            onClick={() => set(n)}
            className={`btn join-item btn-lg flex-1 font-mono ${
              value === n ? (team === "A" ? "btn-primary" : "btn-info") : ""
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div className="flex flex-col gap-3">
      {row("A", a, setA)}
      {row("B", b, setB)}
      <p className="text-xs text-base-content/60">
        Jogo empatado ou sem fim no tempo não conta. 1–1 e 0–0 são empate.
      </p>
      {a !== null && <input type="hidden" name="gamesA" value={a} />}
      {b !== null && <input type="hidden" name="gamesB" value={b} />}
      <button
        type="submit"
        className="btn btn-primary btn-lg h-auto min-h-16"
        disabled={pending || !valid}
      >
        {pending && <span className="loading loading-spinner" />}
        {preview
          ? `Enviar: ${preview}`
          : a === 2 && b === 2
            ? "Melhor de 3: no máximo 2–1"
            : "Escolha os jogos"}
      </button>
    </div>
  );
}
