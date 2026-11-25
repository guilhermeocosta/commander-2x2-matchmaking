import type { LiveRound } from "@/core/event-state";
import { formatClock, timerView } from "@/core/timer";

/** The state of the clock in a few words, or null while it simply runs. */
export function clockLabel(round: LiveRound, now: number): string | null {
  const view = timerView(round, now);
  if (round.status === "closed") return "Rodada encerrada";
  if (round.status === "published") return "Aguardando início";
  if (view.paused) return view.overtime ? "Pausado · tempo esgotado" : "Pausado";
  if (view.overtime) return "Tempo esgotado";
  return null;
}

/**
 * The round's remaining time as "mm:ss". Size it with `className` (font size); colors follow
 * the clock: warning while paused, error in overtime.
 */
export function RoundClock({
  round,
  now,
  className = "text-5xl",
  labelClassName = "text-sm",
}: {
  round: LiveRound;
  now: number;
  className?: string;
  labelClassName?: string;
}) {
  const view = timerView(round, now);
  const label = clockLabel(round, now);
  const color = view.overtime ? "text-error" : view.paused ? "text-warning" : "text-base-content";
  return (
    <div className="flex flex-col items-center" role="timer" aria-live="off">
      <span className={`font-mono leading-none font-bold tabular-nums ${color} ${className}`}>
        {formatClock(view.remainingSec)}
      </span>
      {label && (
        <span className={`font-semibold text-base-content/70 ${labelClassName}`}>{label}</span>
      )}
    </div>
  );
}

/** Shown quietly when the last poll failed; the page keeps the last good snapshot. */
export function OfflineBadge({ offline }: { offline: boolean }) {
  if (!offline) return null;
  return (
    <span role="status" className="badge badge-ghost badge-sm text-base-content/60">
      sem conexão
    </span>
  );
}
