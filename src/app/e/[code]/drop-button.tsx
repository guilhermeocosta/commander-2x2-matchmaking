"use client";

import { useActionState, useState } from "react";

import { dropSelfAction, type PlayerFormState } from "./actions";

const initialState: PlayerFormState = {};

/** "Sair do evento" with an inline confirmation step. `onDone` runs after the action. */
export function DropButton({ code, onDone }: { code: string; onDone?: () => void }) {
  const [state, formAction, pending] = useActionState(async () => {
    const result = await dropSelfAction(code);
    onDone?.();
    return result;
  }, initialState);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        className="btn btn-outline btn-error"
        onClick={() => setConfirming(true)}
      >
        Sair do evento
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-box bg-base-300 p-4">
      <p>
        Tem certeza? Você não será pareado nas próximas rodadas. Seus resultados até agora continuam
        valendo.
      </p>
      {state.error && (
        <div role="alert" className="alert alert-error alert-soft">
          {state.error}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-error" disabled={pending}>
          {pending && <span className="loading loading-spinner" />}
          Sim, sair do evento
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
  );
}
