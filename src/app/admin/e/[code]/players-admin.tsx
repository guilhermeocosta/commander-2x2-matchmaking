"use client";

import { useActionState, useState } from "react";

import type { PlayerStatus } from "@/core/players";
import type { RosterEntry } from "@/core/roster";

import {
  addPlayerAction,
  reissueLinkAction,
  setDroppedAction,
  updatePlayerAction,
  type PlayerAdminState,
} from "./actions";

const initialState: PlayerAdminState = {};

export interface AdminPlayer {
  id: string;
  displayName: string;
  rosterId: string | null;
  /** The roster's name for `rosterId`, when the roster loaded and lists it. */
  rosterName: string | null;
  hasDevice: boolean;
  status: PlayerStatus;
}

function StatusBadge({ status }: { status: PlayerStatus }) {
  switch (status.kind) {
    case "active":
      return <span className="badge badge-sm badge-success">ativo</span>;
    case "dropped":
      return <span className="badge badge-sm badge-neutral">desistiu</span>;
    case "late":
      return <span className="badge badge-sm badge-info">entra na rodada {status.round}</span>;
  }
}

function Feedback({ state }: { state: PlayerAdminState }) {
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

/** Roster options; ids taken by other players are disabled (one roster id per event). */
function RosterSelect({
  roster,
  takenRosterIds,
  current,
}: {
  roster: RosterEntry[];
  takenRosterIds: string[];
  current: string | null;
}) {
  const taken = new Set(takenRosterIds);
  // Keep a linked id selectable even if the roster no longer lists it (or didn't load).
  const missing = current && !roster.some((entry) => entry.id === current);
  return (
    <label className="floating-label">
      <span>Nome na lista da temporada</span>
      <select name="rosterId" defaultValue={current ?? ""} className="select w-full">
        <option value="">Sem vínculo</option>
        {missing && <option value={current}>{current}</option>}
        {roster.map((entry) => (
          <option
            key={entry.id}
            value={entry.id}
            disabled={taken.has(entry.id) && entry.id !== current}
          >
            {entry.name}
            {taken.has(entry.id) && entry.id !== current ? " (já inscrito)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AddPlayerForm({
  code,
  roster,
  takenRosterIds,
}: {
  code: string;
  roster: RosterEntry[];
  takenRosterIds: string[];
}) {
  const [state, formAction, pending] = useActionState(
    addPlayerAction.bind(null, code),
    initialState
  );
  return (
    <form action={formAction} className="flex flex-col gap-3 pt-2">
      <label className="floating-label">
        <span>Nome</span>
        <input
          type="text"
          name="name"
          placeholder="Nome (opcional se escolher da lista)"
          maxLength={60}
          className="input w-full"
        />
      </label>
      {roster.length > 0 && (
        <RosterSelect roster={roster} takenRosterIds={takenRosterIds} current={null} />
      )}
      <Feedback state={state} />
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending && <span className="loading loading-spinner" />}
        Adicionar
      </button>
    </form>
  );
}

export function PlayerRow({
  code,
  player,
  roster,
  takenRosterIds,
}: {
  code: string;
  player: AdminPlayer;
  roster: RosterEntry[];
  takenRosterIds: string[];
}) {
  const [editState, editAction, editing] = useActionState(
    updatePlayerAction.bind(null, code),
    initialState
  );
  const [dropState, dropAction, dropping] = useActionState(
    setDroppedAction.bind(null, code),
    initialState
  );
  const [linkState, linkAction, linking] = useActionState(
    reissueLinkAction.bind(null, code),
    initialState
  );
  const [copied, setCopied] = useState(false);
  const dropped = player.status.kind === "dropped";

  return (
    <li className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`min-w-0 flex-1 font-medium break-words ${dropped ? "opacity-60" : ""}`}>
          {player.displayName}
        </span>
        <StatusBadge status={player.status} />
      </div>
      <div className="flex flex-wrap gap-x-3 text-xs text-base-content/60">
        <span>
          {player.rosterId
            ? `Temporada: ${player.rosterName ?? player.rosterId}`
            : "Fora da lista da temporada"}
        </span>
        {!player.hasDevice && <span>Sem aparelho</span>}
      </div>

      <details className="group">
        <summary className="link link-hover cursor-pointer text-sm text-primary">Gerenciar</summary>
        <div className="mt-3 flex flex-col gap-4">
          {/* Keyed on the saved values: React resets a form after its action, and a remount
              makes the inputs pick up the new defaults (a <select> wouldn't otherwise). */}
          <form
            key={`${player.displayName}|${player.rosterId ?? ""}`}
            action={editAction}
            className="flex flex-col gap-3"
          >
            <input type="hidden" name="playerId" value={player.id} />
            <label className="floating-label">
              <span>Nome</span>
              <input
                type="text"
                name="name"
                defaultValue={player.displayName}
                required
                maxLength={60}
                className="input w-full"
              />
            </label>
            <RosterSelect
              roster={roster}
              takenRosterIds={takenRosterIds}
              current={player.rosterId}
            />
            <Feedback state={editState} />
            <button type="submit" className="btn btn-sm btn-primary" disabled={editing}>
              {editing && <span className="loading loading-spinner" />}
              Salvar
            </button>
          </form>

          <form action={dropAction} className="flex flex-col gap-2">
            <input type="hidden" name="playerId" value={player.id} />
            <input type="hidden" name="dropped" value={dropped ? "false" : "true"} />
            <Feedback state={dropState} />
            <button
              type="submit"
              className={`btn btn-sm ${dropped ? "btn-outline" : "btn-outline btn-error"}`}
              disabled={dropping}
            >
              {dropping && <span className="loading loading-spinner" />}
              {dropped ? "Desfazer desistência" : "Marcar desistência"}
            </button>
          </form>

          <form action={linkAction} className="flex flex-col gap-2">
            <input type="hidden" name="playerId" value={player.id} />
            <p className="text-xs text-base-content/60">
              Gera um link para o jogador usar em outro aparelho. O aparelho atual deixa de
              funcionar, e o link vale uma única vez.
            </p>
            <button type="submit" className="btn btn-sm btn-outline" disabled={linking}>
              {linking && <span className="loading loading-spinner" />}
              Gerar link para outro aparelho
            </button>
            {linkState.error && <Feedback state={linkState} />}
            {linkState.link && (
              <div className="flex flex-col items-center gap-2 rounded-box bg-base-200 p-3">
                <div
                  className="w-48 overflow-hidden rounded-box [&>svg]:h-auto [&>svg]:w-full"
                  role="img"
                  aria-label="QR code do link para outro aparelho"
                  // SVG markup generated on the server by the qrcode package.
                  dangerouslySetInnerHTML={{ __html: linkState.link.qr }}
                />
                <p className="w-full font-mono text-xs break-all">{linkState.link.url}</p>
                <button
                  type="button"
                  className="btn btn-xs btn-ghost"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(linkState.link?.url ?? "");
                      setCopied(true);
                    } catch {
                      setCopied(false);
                    }
                  }}
                >
                  {copied ? "Copiado" : "Copiar link"}
                </button>
              </div>
            )}
          </form>
        </div>
      </details>
    </li>
  );
}
