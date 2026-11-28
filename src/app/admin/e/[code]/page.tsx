import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getEventByCode } from "@/db/queries";
import { StandingsTable } from "@/components/standings-table";
import { requireAdmin } from "@/lib/auth";
import { loadStandings } from "@/lib/standings";

import { AdminHeader, EventStatusBadge, formatEventDate } from "../../ui";
import { ExportSection } from "./export-section";
import { PlayersSection } from "./players-section";
import { RoundsSection } from "./rounds-section";

export const metadata: Metadata = { title: "Evento · Admin · Commander 2x2" };

// Check the session before rendering anything, so logged-out visits get a real 307.
export const instant = false;

export default async function AdminEventPage({ params }: PageProps<"/admin/e/[code]">) {
  await requireAdmin();
  const { code } = await params;
  // getEventByCode validates the code (Zod) and returns undefined for anything malformed.
  const event = await getEventByCode(code);
  if (!event) notFound();

  return (
    <>
      <AdminHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
        <Link href="/admin" className="link link-hover text-sm text-base-content/70">
          ← Eventos
        </Link>
        <section className="card bg-base-200">
          <div className="card-body gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-3xl font-bold tracking-widest text-primary">
                {event.code}
              </span>
              <EventStatusBadge status={event.status} />
            </div>
            <h1 className="text-2xl font-bold break-words">{event.name}</h1>
            <p className="text-base-content/70">
              {formatEventDate(event.date)} · {event.rounds} rodadas de{" "}
              {Math.round(event.roundDurationSec / 60)} minutos
            </p>
          </div>
        </section>

        <PlayersSection event={event} />

        <RoundsSection event={event} />

        <section id="classificacao" className="card bg-base-200">
          <div className="card-body gap-3">
            <h2 className="card-title">Classificação</h2>
            <StandingsTable standings={await loadStandings(event)} />
          </div>
        </section>

        <ExportSection event={event} />
      </main>
    </>
  );
}
