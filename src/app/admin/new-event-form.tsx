"use client";

import { useActionState } from "react";

import { createEventAction, type FormState } from "./actions";

const initialState: FormState = {};

export function NewEventForm() {
  const [state, formAction, pending] = useActionState(createEventAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="floating-label">
        <span>Nome</span>
        <input
          type="text"
          name="name"
          placeholder="Nome do evento"
          required
          maxLength={100}
          className="input w-full"
        />
      </label>
      <label className="floating-label">
        <span>Data</span>
        <input type="date" name="date" required className="input w-full" />
      </label>
      <p className="text-sm text-base-content/70">3 rodadas de 50 minutos.</p>
      {state.error && (
        <div role="alert" className="alert alert-error alert-soft">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div role="status" className="alert alert-success alert-soft">
          {state.ok}
        </div>
      )}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending && <span className="loading loading-spinner" />}
        Criar evento
      </button>
    </form>
  );
}
