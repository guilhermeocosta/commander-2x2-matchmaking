import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { canStillPlay, isEventFull } from "@/core/players";
import { getEventByCode, getLatestPairedRoundNumber, listEventPlayers } from "@/db/queries";
import { loadEventState } from "@/lib/event-state";
import { getCurrentPlayer } from "@/lib/player-session";
import { EVENT_FULL, isJoinable } from "@/lib/players";
import { getRoster } from "@/lib/roster";
import { loadStandings } from "@/lib/standings";

import { JoinForm } from "./join-form";
import { LiveRoundCard } from "./live-round";

export const metadata: Metadata = { title: "Evento · Commander 2x2" };

// Reads the device cookie: always rendered per request.
export const instant = false;

export default async function EventPage({ params }: PageProps<"/e/[code]">) {
  const { code } = await params;
  const event = await getEventByCode(code);
  if (!event) notFound();

  const [player, latestRound] = await Promise.all([
    getCurrentPlayer(event),
    getLatestPairedRoundNumber(event.id),
  ]);

  let body: React.ReactNode;
  if (player) {
    const [initial, standings] = await Promise.all([loadEventState(event), loadStandings(event)]);
    body = <LiveRoundCard code={event.code} initial={initial} initialStandings={standings} />;
  } else if (!isJoinable(event)) {
    body = <Notice>As inscrições deste evento estão encerradas.</Notice>;
  } else if (!canStillPlay(latestRound, event.rounds)) {
    body = <Notice>Todas as rodadas já foram pareadas; não dá mais para entrar.</Notice>;
  } else {
    const [roster, players] = await Promise.all([getRoster(), listEventPlayers(event.id)]);
    const taken = new Set(players.map((p) => p.rosterId).filter((id) => id !== null));
    body = isEventFull(players.length) ? (
      <Notice>{EVENT_FULL} Fale com a organização.</Notice>
    ) : (
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
