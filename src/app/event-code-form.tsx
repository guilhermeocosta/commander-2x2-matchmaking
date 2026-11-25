"use client";

import { useActionState } from "react";

import { goToEventAction, type CodeFormState } from "./actions";

const initialState: CodeFormState = {};

export function EventCodeForm() {
  const [state, formAction, pending] = useActionState(goToEventAction, initialState);

  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      <label className="floating-label">
        <span>Código do evento</span>
        <input
          type="text"
          name="code"
          placeholder="Código do evento"
          required
          minLength={4}
          maxLength={4}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="input input-lg w-full text-center font-mono tracking-widest uppercase"
        />
      </label>
      {state.error && (
        <div role="alert" className="alert alert-error alert-soft">
          {state.error}
        </div>
      )}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending && <span className="loading loading-spinner" />}
        Entrar
      </button>
    </form>
  );
}
