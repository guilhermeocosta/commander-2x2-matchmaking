"use client";

import type { EventState } from "@/core/event-state";
import { tablesMissingResults } from "@/core/report";
import { seatLabel } from "@/lib/round-copy";
import { useEventState, useServerNow } from "@/lib/use-event-state";

import { CloseRoundButton, ResultsGrid, type ResultTableView } from "./results-admin";
import { RoundTimerAdmin } from "./round-timer-admin";

/**
 * The admin's live view of the published round: the timer, every table's result as players
 * report it, and "Encerrar rodada". One poll feeds all three. `seatIds` maps "table:A1" to the
 * player id (the public snapshot has names only), for "Jogador saiu no meio do jogo".
 */
export function LiveRoundAdmin({
  code,
  initial,
  seatIds,
}: {
  code: string;
  initial: EventState;
  seatIds: Record<string, string>;
}) {
  const { state, offsetMs, offline, refresh } = useEventState(code, initial);
  const snapshot = state ?? initial;
  const now = useServerNow(offsetMs, snapshot.now);
  const round = snapshot.round;
  if (!round) return null;

  const tables: ResultTableView[] = round.tables.map((t) => ({
    number: t.number,
    kind: t.kind,
    result: t.result,
    seats: t.seats.map((s) => ({
      ...s,
      playerId: seatIds[`${t.number}:${seatLabel(s)}`] ?? "",
    })),
  }));
  const missing = tablesMissingResults(
    round.tables.map((t) => ({ ...t, outcome: t.result?.outcome ?? null }))
  ).map((t) => t.number);

  return (
    <div className="flex flex-col gap-4">
      <RoundTimerAdmin code={code} round={round} now={now} offline={offline} refresh={refresh} />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-bold">Resultados</h4>
          <span className="text-sm text-base-content/70">
            {missing.length === 0
              ? "Todas as mesas com resultado"
              : `${missing.length} ${missing.length === 1 ? "mesa" : "mesas"} sem resultado`}
          </span>
        </div>
        <ResultsGrid code={code} round={round.number} tables={tables} onDone={refresh} />
      </div>
      {round.status !== "closed" && (
        <CloseRoundButton code={code} round={round.number} missing={missing} onDone={refresh} />
      )}
    </div>
  );
}
