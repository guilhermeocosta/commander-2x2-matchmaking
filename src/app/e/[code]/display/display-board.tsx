"use client";

import { OfflineBadge, RoundClock } from "@/components/round-clock";
import { omwLabel, recordLabel, type EventStandings } from "@/core/event-standings";
import type { EventState, LiveTable } from "@/core/event-state";
import { timerView } from "@/core/timer";
import { overtimeMessage, seatLabel, tableTitle, turnOrder } from "@/lib/round-copy";
import { useEventState, useServerNow } from "@/lib/use-event-state";
import { useStandings } from "@/lib/use-standings";

/** Between rounds the display refreshes the standings this often (admin fixes after closing). */
const STANDINGS_REFRESH_MS = 30_000;

const teamText = { A: "text-primary", B: "text-info" } as const;

/** Columns for `n` tables, so up to 12 fit one 16:9 screen. */
function columnsFor(n: number): number {
  if (n <= 2) return Math.max(n, 1);
  if (n <= 4) return 2;
  if (n <= 9) return 3;
  return 4;
}

/**
 * Font size for the table cards: as large as fits both the height (about 8.5 lines per card,
 * below a header of ~22vh) and the width (about 14 characters per column).
 */
function cardFontSize(n: number): string {
  const cols = columnsFor(n);
  const rows = Math.max(1, Math.ceil(n / cols));
  return `min(${(74 / rows / 8.5).toFixed(2)}vh, ${(100 / cols / 11).toFixed(2)}vw)`;
}

export function DisplayBoard({
  code,
  initial,
  initialStandings,
}: {
  code: string;
  initial: EventState;
  initialStandings: EventStandings | null;
}) {
  const { state, offsetMs, offline } = useEventState(code, initial);
  const snapshot = state ?? initial;
  const now = useServerNow(offsetMs, snapshot.now);
  const { event, round } = snapshot;
  const live = round && round.status !== "closed" ? round : null;
  const standings = useStandings(
    code,
    `${round?.number ?? 0}:${round?.status === "closed"}:${event.status}`,
    initialStandings,
    live ? undefined : STANDINGS_REFRESH_MS
  );
  const overtime = live ? timerView(live, now).overtime : false;
  const kinds = new Set(live?.tables.map((t) => t.kind));

  return (
    <main className="flex h-dvh flex-col gap-[2vh] overflow-hidden p-[2vh]">
      <header className="flex items-center justify-between gap-[3vw]">
        <div className="min-w-0">
          <p className="font-mono text-[3vh] font-bold tracking-widest text-primary">
            {event.code}
          </p>
          <h1 className="truncate text-[5vh] leading-tight font-bold">{event.name}</h1>
          <p className="text-[3.5vh] text-base-content/70">
            {live
              ? `Rodada ${live.number} de ${event.rounds}`
              : standings
                ? event.status === "finished"
                  ? "Classificação final"
                  : `Classificação após a rodada ${standings.throughRound} · próxima: rodada ${standings.throughRound + 1}`
                : "Entre pelo celular com o código"}
          </p>
        </div>
        <div className="flex items-center gap-[2vw]">
          <OfflineBadge offline={offline} />
          {live && (
            <RoundClock
              round={live}
              now={now}
              className="text-[17vh]"
              labelClassName="text-[3vh]"
            />
          )}
        </div>
      </header>

      {overtime && (
        <div
          role="alert"
          className="flex flex-wrap justify-center gap-x-[3vw] rounded-box bg-error/15 px-[2vw] py-[1vh] text-[4vh] font-bold text-error"
        >
          {kinds.has("2v2") && <span>2v2: {overtimeMessage("2v2")}</span>}
          {kinds.has("1v1") && <span>1v1: {overtimeMessage("1v1")}</span>}
        </div>
      )}

      {live ? (
        <TablesGrid tables={live.tables} />
      ) : standings ? (
        <StandingsBoard standings={standings} finished={event.status === "finished"} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-[2vh] text-center">
          <p className="text-[6vh] font-bold">
            {event.status === "finished" || (round && round.number >= event.rounds)
              ? "Rodadas encerradas"
              : `Aguardando a rodada ${(round?.number ?? 0) + 1}`}
          </p>
          <p className="text-[4vh] text-base-content/70">
            Código do evento:{" "}
            <span className="font-mono font-bold tracking-widest text-primary">{event.code}</span>
          </p>
        </div>
      )}
    </main>
  );
}

function TablesGrid({ tables }: { tables: readonly LiveTable[] }) {
  const cols = columnsFor(tables.length);
  return (
    <ol
      className="grid min-h-0 flex-1 content-start gap-[1.5vh]"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        fontSize: cardFontSize(tables.length),
      }}
    >
      {tables.map((table) => (
        <li key={table.number} className="rounded-box bg-base-200 px-[0.8em] py-[0.5em]">
          <h2 className="text-[1.25em] leading-snug font-bold">
            {tableTitle(table.kind, table.number)}
          </h2>
          <ul className="leading-snug">
            {turnOrder(table.seats).map((seat) => (
              <li key={seatLabel(seat)} className="flex items-baseline gap-[0.5em]">
                {table.kind !== "bye" && (
                  <span className={`w-[1.7em] font-mono font-bold ${teamText[seat.team]}`}>
                    {seatLabel(seat)}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">{seat.name}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

/** The standings on the projector: up to 20 rows per column, two columns past that. */
function StandingsBoard({ standings, finished }: { standings: EventStandings; finished: boolean }) {
  const perColumn = standings.rows.length > 20 ? Math.ceil(standings.rows.length / 2) : 20;
  const columns = [standings.rows.slice(0, perColumn), standings.rows.slice(perColumn)].filter(
    (c) => c.length > 0
  );
  const lines = Math.max(perColumn, 8) + 1;
  return (
    <div
      className="mx-auto grid min-h-0 w-full flex-1 content-start gap-[3vw]"
      style={{
        maxWidth: columns.length === 1 ? "36em" : undefined,
        gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
        fontSize: `min(${(70 / lines).toFixed(2)}vh, ${(columns.length === 1 ? 3 : 1.6).toFixed(2)}vw)`,
      }}
      aria-label={finished ? "Classificação final" : "Classificação"}
    >
      {columns.map((rows, i) => (
        <table key={i} className="w-full leading-snug">
          <thead className="text-base-content/60">
            <tr>
              <th className="w-[2.5em] pr-[0.5em] text-right">#</th>
              <th className="text-left">Jogador</th>
              <th className="w-[3em] text-right">Pts</th>
              <th className="w-[5em] text-center">V-E-D</th>
              <th className="w-[4.5em] text-right">OMW%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rank} className="even:bg-base-200">
                <td className="pr-[0.5em] text-right font-mono tabular-nums">{row.rank}</td>
                <td className="max-w-0 truncate">
                  {row.name}
                  {row.dropped && <span className="text-base-content/50"> (saiu)</span>}
                </td>
                <td className="text-right font-mono font-bold text-primary tabular-nums">
                  {row.points}
                </td>
                <td className="text-center font-mono tabular-nums">{recordLabel(row)}</td>
                <td className="text-right font-mono tabular-nums">{omwLabel(row.omw)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}
