"use client";

import { useActionState } from "react";

import { OfflineBadge, RoundClock } from "@/components/round-clock";
import type { LiveRound } from "@/core/event-state";
import { allowedTimerActions, type TimerAction } from "@/core/timer";

import { roundTimerAction, type RoundAdminState } from "./round-actions";

const buttons: { action: TimerAction; label: string; className: string }[] = [
  { action: "start", label: "Iniciar", className: "btn-primary" },
  { action: "pause", label: "Pausar", className: "btn-warning" },
  { action: "resume", label: "Retomar", className: "btn-primary" },
  { action: "add5", label: "+5 min", className: "btn-outline" },
];

/**
 * The live clock of the published round and its controls. Rendered only for the admin, inside
 * `LiveRoundAdmin`, which owns the poll.
 */
export function RoundTimerAdmin({
  code,
  round,
  now,
  offline,
  refresh,
}: {
  code: string;
  round: LiveRound;
  now: number;
  offline: boolean;
  refresh: () => Promise<void>;
}) {
  const [result, formAction, pending] = useActionState(
    async (prev: RoundAdminState, formData: FormData) => {
      const next = await roundTimerAction(code, prev, formData);
      await refresh();
      return next;
    },
    {}
  );

  if (round.status === "closed") return null;
  const allowed = new Set(allowedTimerActions(round, now));

  return (
    <div className="flex flex-col gap-3 rounded-box bg-base-100 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-base-content/70">Cronômetro</span>
        <OfflineBadge offline={offline} />
      </div>
      <RoundClock round={round} now={now} className="text-6xl" />
      <form action={formAction} className="flex flex-wrap justify-center gap-2">
        <input type="hidden" name="round" value={round.number} />
        {buttons
          .filter((b) => allowed.has(b.action) || b.action === "add5")
          .map((b) => (
            <button
              key={b.action}
              type="submit"
              name="action"
              value={b.action}
              className={`btn ${b.className}`}
              disabled={pending || !allowed.has(b.action)}
            >
              {b.label}
            </button>
          ))}
      </form>
      {result.error && (
        <div role="alert" className="alert alert-error alert-soft text-sm">
          {result.error}
        </div>
      )}
    </div>
  );
}
