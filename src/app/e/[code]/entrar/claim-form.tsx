"use client";

import { useActionState, useSyncExternalStore } from "react";

import { claimLinkAction, type PlayerFormState } from "../actions";

const initialState: PlayerFormState = {};

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

const readToken = () => window.location.hash.slice(1);
const noToken = () => "";

export function ClaimForm({ code }: { code: string }) {
  const [state, formAction, pending] = useActionState(
    claimLinkAction.bind(null, code),
    initialState
  );
  const token = useSyncExternalStore(subscribe, readToken, noToken);

  if (!token) {
    return (
      <div role="alert" className="alert alert-error alert-soft">
        Link incompleto. Peça um novo à organização.
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      {state.error && (
        <div role="alert" className="alert alert-error alert-soft">
          {state.error}
        </div>
      )}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending && <span className="loading loading-spinner" />}
        Entrar neste aparelho
      </button>
    </form>
  );
}
