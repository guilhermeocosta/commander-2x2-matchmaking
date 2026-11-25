"use client";

import { useActionState, useMemo, useState } from "react";

import { filterRoster, type RosterEntry } from "@/core/roster";

import { joinAction, type PlayerFormState } from "./actions";

const initialState: PlayerFormState = {};

export interface JoinRosterEntry extends RosterEntry {
  /** Already joined this event. */
  taken: boolean;
}

export function JoinForm({ code, roster }: { code: string; roster: JoinRosterEntry[] }) {
  const [state, formAction, pending] = useActionState(joinAction.bind(null, code), initialState);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<JoinRosterEntry | null>(null);
  const matches = useMemo(() => filterRoster(roster, query), [roster, query]);

  return (
    <div className="flex flex-col gap-6">
      {roster.length > 0 && (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="mode" value="roster" />
          <input type="hidden" name="rosterId" value={selected?.id ?? ""} />
          <label className="floating-label">
            <span>Buscar seu nome</span>
            <input
              type="search"
              placeholder="Buscar seu nome na lista"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              className="input w-full"
            />
          </label>
          <ul
            className="list max-h-64 overflow-y-auto rounded-box bg-base-100"
            aria-label="Jogadores da temporada"
          >
            {matches.length === 0 && (
              <li className="p-3 text-sm text-base-content/70">Ninguém com esse nome na lista.</li>
            )}
            {matches.map((entry) => (
              <li key={entry.id}>
                <label
                  className={`flex items-center gap-3 px-3 py-2 ${
                    entry.taken ? "opacity-50" : "cursor-pointer hover:bg-base-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="pick"
                    className="radio radio-sm radio-primary"
                    checked={selected?.id === entry.id}
                    disabled={entry.taken}
                    onChange={() => setSelected(entry)}
                  />
                  <span className="flex-1 break-words">{entry.name}</span>
                  {entry.taken && <span className="badge badge-ghost badge-sm">já inscrito</span>}
                </label>
              </li>
            ))}
          </ul>
          <button type="submit" className="btn btn-primary" disabled={!selected || pending}>
            {pending && <span className="loading loading-spinner" />}
            {selected ? `Entrar como ${selected.name}` : "Escolha seu nome na lista"}
          </button>
        </form>
      )}

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="mode" value="name" />
        <p className="text-sm text-base-content/70">
          {roster.length > 0
            ? "Não está na lista? Digite seu nome:"
            : "Digite seu nome para entrar no evento:"}
        </p>
        <label className="floating-label">
          <span>Seu nome</span>
          <input
            type="text"
            name="name"
            placeholder="Seu nome"
            required
            maxLength={60}
            autoComplete="name"
            className="input w-full"
          />
        </label>
        <button
          type="submit"
          className={`btn ${roster.length > 0 ? "btn-outline" : "btn-primary"}`}
          disabled={pending}
        >
          Entrar com este nome
        </button>
      </form>

      {state.error && (
        <div role="alert" className="alert alert-error alert-soft">
          {state.error}
        </div>
      )}
    </div>
  );
}
