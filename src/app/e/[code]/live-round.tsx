"use client";

import { OfflineBadge, RoundClock } from "@/components/round-clock";
import { mySeatView, type EventState, type LiveRound } from "@/core/event-state";
import { timerView } from "@/core/timer";
import { overtimeMessage, seatLabel, tableTitle, turnOrder } from "@/lib/round-copy";
import { useEventState, useServerNow } from "@/lib/use-event-state";

import { DropButton } from "./drop-button";

const teamBadge = { A: "badge-primary", B: "badge-info" } as const;

/** The joined player's live card: their seat and the timer, or what they're waiting for. */
export function LiveRoundCard({ code, initial }: { code: string; initial: EventState }) {
  const { state, offsetMs, offline, refresh } = useEventState(code, initial);
  const now = useServerNow(offsetMs, (state ?? initial).now);
  const snapshot = state ?? initial;
  const { me, round, event } = snapshot;

  if (!me) {
    return (
      <Card>
        <p>Este aparelho não está mais inscrito no evento. Fale com a organização.</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0">
          Você está inscrito como{" "}
          <strong className="text-lg break-words text-primary">{me.name}</strong>
        </p>
        <OfflineBadge offline={offline} />
      </div>

      {me.dropped ? (
        <div role="status" className="alert alert-warning alert-soft">
          Você saiu do evento. Para voltar, fale com a organização.
        </div>
      ) : (
        <>
          <RoundBody snapshot={snapshot} round={round} now={now} />
          {event.status !== "finished" && <DropButton code={code} onDone={refresh} />}
        </>
      )}
    </Card>
  );
}

function RoundBody({
  snapshot,
  round,
  now,
}: {
  snapshot: EventState;
  round: LiveRound | null;
  now: number;
}) {
  const { me, event } = snapshot;
  if (!me) return null;

  // Between rounds: nothing published yet, or the last round closed.
  if (!round || round.status === "closed") {
    const next = (round?.number ?? 0) + 1;
    let message = `Aguarde o pareamento da rodada ${next}.`;
    if (event.status === "finished" || next > event.rounds) message = "As rodadas terminaram.";
    else if (me.joinedRound > next) message = `Você entra na rodada ${me.joinedRound}.`;
    return (
      <div role="status" className="rounded-box bg-base-100 p-4 text-center">
        <p className="font-semibold">{round ? `Rodada ${round.number} encerrada` : "Aguarde"}</p>
        <p className="text-base-content/70">{message}</p>
      </div>
    );
  }

  const view = mySeatView(snapshot);
  const overtime = timerView(round, now).overtime;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-1 rounded-box bg-base-100 p-4">
        <span className="text-sm font-semibold text-base-content/70">Rodada {round.number}</span>
        <RoundClock round={round} now={now} className="text-6xl" />
      </div>

      {!view ? (
        <p className="text-base-content/70" role="status">
          {me.joinedRound > round.number
            ? `Você entra na rodada ${me.joinedRound}. Aguarde o pareamento.`
            : "Você não está nesta rodada. Fale com a organização."}
        </p>
      ) : view.table.kind === "bye" ? (
        <div role="status" className="alert alert-info alert-soft">
          <div>
            <p className="font-bold">Você está de bye nesta rodada.</p>
            <p>O bye conta como vitória. Aguarde a próxima rodada.</p>
          </div>
        </div>
      ) : (
        <>
          {overtime && (
            <div role="alert" className="alert alert-error alert-soft text-lg font-bold">
              {overtimeMessage(view.table.kind)}
            </div>
          )}
          <div className="flex flex-col gap-3 rounded-box bg-base-100 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-3xl font-bold">
                {tableTitle(view.table.kind, view.table.number)}
              </h2>
              <span className={`badge badge-lg font-mono ${teamBadge[view.seat.team]}`}>
                {seatLabel(view.seat)}
              </span>
            </div>
            {view.teammate && (
              <p>
                <span className="text-base-content/70">Sua dupla: </span>
                <strong className="break-words">{view.teammate.name}</strong>
              </p>
            )}
            <p>
              <span className="text-base-content/70">
                {view.opponents.length === 1 ? "Oponente: " : "Oponentes: "}
              </span>
              <strong className="break-words">
                {view.opponents.map((s) => s.name).join(" e ")}
              </strong>
            </p>
            <ol className="flex flex-col gap-1.5 border-t border-base-300 pt-3">
              {turnOrder(view.table.seats).map((s) => {
                const isMe = s.team === view.seat.team && s.position === view.seat.position;
                return (
                  <li key={seatLabel(s)} className="flex items-center gap-2">
                    <span className={`badge badge-sm w-8 font-mono ${teamBadge[s.team]}`}>
                      {seatLabel(s)}
                    </span>
                    <span className={`min-w-0 flex-1 truncate ${isMe ? "font-bold" : ""}`}>
                      {s.name}
                      {isMe && " (você)"}
                    </span>
                  </li>
                );
              })}
            </ol>
            {view.table.kind === "2v2" && (
              <p className="text-xs text-base-content/60">Ordem dos turnos: A1, B1, A2, B2.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="card bg-base-200">
      <div className="card-body gap-4">{children}</div>
    </section>
  );
}
