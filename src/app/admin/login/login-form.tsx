"use client";

import { useActionState } from "react";

import { loginAction, type FormState } from "../actions";

const initialState: FormState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="floating-label">
        <span>Senha</span>
        <input
          type="password"
          name="password"
          placeholder="Senha"
          autoComplete="current-password"
          required
          maxLength={200}
          className="input input-lg w-full"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "login-error" : undefined}
        />
      </label>
      {state.error && (
        <div id="login-error" role="alert" className="alert alert-error alert-soft">
          {state.error}
        </div>
      )}
      <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
        {pending && <span className="loading loading-spinner" />}
        Entrar
      </button>
    </form>
  );
}
