"use client";

import { useActionState, useState } from "react";

import {
  finishEventAction,
  generateRoundAction,
  publishRoundAction,
  rerollRoundAction,
  swapPlayersAction,
  type RoundAdminState,
} from "./round-actions";

const initialState: RoundAdminState = {};

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

function Spinner({ show }: { show: boolean }) {
  return show ? <span className="loading loading-spinner loading-sm" /> : null;
}

export function GenerateRoundButton({
  code,
  round,
  disabledReason,
}: {
  code: string;
  round: number;
  /** pt-BR reason shown under a disabled button; null when generating is allowed. */
  disabledReason: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    generateRoundAction.bind(null, code),
    initialState
  );
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="round" value={round} />
      <button
        type="submit"
        className="btn btn-primary"
        disabled={pending || disabledReason !== null}
      >
        <Spinner show={pending} />
        Gerar rodada {round}
      </button>
      {disabledReason && <p className="text-sm text-base-content/70">{disabledReason}</p>}
      <Feedback state={state} />
    </form>
  );
}

/** "Publicar" with an inline confirmation, and "Sortear de novo". */
export function DraftActions({
  code,
  round,
  canPublish,
}: {
  code: string;
  round: number;
  canPublish: boolean;
}) {
  const [publishState, publishAction, publishing] = useActionState(
    publishRoundAction.bind(null, code),
    initialState
  );
  const [rerollState, rerollAction, rerolling] = useActionState(
    rerollRoundAction.bind(null, code),
    initialState
  );
  const [confirming, setConfirming] = useState(false);
  const busy = publishing || rerolling;

  return (
    <div className="flex flex-col gap-3">
      {confirming ? (
        <form action={publishAction} className="flex flex-col gap-3 rounded-box bg-base-300 p-4">
          <input type="hidden" name="round" value={round} />
          <p>Publicar a rodada {round}? Os jogadores passam a ver as mesas.</p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <Spinner show={publishing} />
              Sim, publicar
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !canPublish}
            onClick={() => setConfirming(true)}
          >
            Publicar
          </button>
          <form action={rerollAction}>
            <input type="hidden" name="round" value={round} />
            <button type="submit" className="btn btn-outline" disabled={busy}>
              <Spinner show={rerolling} />
              Sortear de novo
            </button>
          </form>
        </div>
      )}
      <Feedback state={publishState} />
      <Feedback state={rerollState} />
    </div>
  );
}

export interface SwapOption {
  playerId: string;
  /** e.g. "Mesa 1 · A1 · Fulano". */
  label: string;
}

/** "Trocar jogadores": pick two seated players and swap their seats. */
export function SwapForm({
  code,
  round,
  options,
}: {
  code: string;
  round: number;
  options: readonly SwapOption[];
}) {
  const [state, formAction, pending] = useActionState(
    swapPlayersAction.bind(null, code),
    initialState
  );
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const select = (name: string, value: string, set: (v: string) => void, label: string) => (
    <label className="floating-label">
      <span>{label}</span>
      <select
        name={name}
        value={value}
        onChange={(e) => set(e.target.value)}
        className="select w-full"
        required
      >
        <option value="" disabled>
          {label}
        </option>
        {options.map((o) => (
          <option key={o.playerId} value={o.playerId}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="round" value={round} />
      {select("playerA", a, setA, "Primeiro jogador")}
      {select("playerB", b, setB, "Segundo jogador")}
      <button
        type="submit"
        className="btn btn-outline"
        disabled={pending || a === "" || b === "" || a === b}
      >
        <Spinner show={pending} />
        Trocar de lugar
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function FinishEventButton({
  code,
  enabled,
  hint,
}: {
  code: string;
  enabled: boolean;
  hint: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    finishEventAction.bind(null, code),
    initialState
  );
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button type="submit" className="btn btn-outline" disabled={pending || !enabled}>
        <Spinner show={pending} />
        Encerrar evento
      </button>
      {hint && <p className="text-sm text-base-content/70">{hint}</p>}
      <Feedback state={state} />
    </form>
  );
}
