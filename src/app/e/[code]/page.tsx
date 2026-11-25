import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { canStillPlay, playerStatus } from "@/core/players";
import { getEventByCode, getLatestRoundNumber, listEventPlayers } from "@/db/queries";
import { getCurrentPlayer } from "@/lib/player-session";
import { isJoinable } from "@/lib/players";
import { getRoster } from "@/lib/roster";

import { DropButton } from "./drop-button";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Evento · Commander 2x2" };

// Reads the device cookie: always rendered per request.
export const instant = false;

export default async function EventPage({ params }: PageProps<"/e/[code]">) {
  const { code } = await params;
  const event = await getEventByCode(code);
  if (!event) notFound();

  const [player, latestRound] = await Promise.all([
    getCurrentPlayer(event),
    getLatestRoundNumber(event.id),
  ]);

  let body: React.ReactNode;
  if (player) {
    const status = playerStatus(player, latestRound);
    body = (
      <section className="card bg-base-200">
        <div className="card-body gap-4">
          <p>
            Você está inscrito como{" "}
            <strong className="text-lg break-words text-primary">{player.displayName}</strong>
          </p>
          {status.kind === "dropped" ? (
            <div role="status" className="alert alert-warning alert-soft">
              Você saiu do evento. Para voltar, fale com a organização.
            </div>
          ) : (
            <>
              <p className="text-base-content/70">
                {status.kind === "late"
                  ? `Você entra na rodada ${status.round}. Aguarde o pareamento.`
                  : "Aguarde o pareamento da rodada."}
              </p>
              <DropButton code={event.code} />
            </>
          )}
        </div>
      </section>
    );
  } else if (!isJoinable(event)) {
    body = <Notice>As inscrições deste evento estão encerradas.</Notice>;
  } else if (!canStillPlay(latestRound, event.rounds)) {
    body = <Notice>Todas as rodadas já foram pareadas; não dá mais para entrar.</Notice>;
  } else {
    const [roster, players] = await Promise.all([getRoster(), listEventPlayers(event.id)]);
    const taken = new Set(players.map((p) => p.rosterId).filter((id) => id !== null));
    body = (
      <section className="card bg-base-200">
        <div className="card-body gap-4">
          <h2 className="card-title">Entrar no evento</h2>
          {latestRound > 0 && (
            <p className="text-sm text-base-content/70">
              O evento já começou: você entra na rodada {latestRound + 1}.
            </p>
          )}
          <JoinForm
            code={event.code}
            roster={roster.map((entry) => ({ ...entry, taken: taken.has(entry.id) }))}
          />
        </div>
      </section>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6">
      <Link href="/" className="link link-hover text-sm text-base-content/70">
        ← Início
      </Link>
      <header className="flex flex-col gap-1">
        <span className="font-mono text-sm font-bold tracking-widest text-primary">
          {event.code}
        </span>
        <h1 className="text-2xl font-bold break-words">{event.name}</h1>
      </header>
      {body}
    </main>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="alert alert-info alert-soft">
      {children}
    </div>
  );
}
