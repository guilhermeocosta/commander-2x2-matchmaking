import type { Metadata } from "next";
import Link from "next/link";

import { listEvents } from "@/db/queries";
import { requireAdmin } from "@/lib/auth";

import { NewEventForm } from "./new-event-form";
import { AdminHeader, EventStatusBadge, formatEventDate } from "./ui";

export const metadata: Metadata = { title: "Eventos · Admin · Commander 2x2" };

// Check the session before rendering anything, so logged-out visits get a real 307.
export const instant = false;

export default async function AdminPage() {
  await requireAdmin();
  const events = await listEvents();

  return (
    <>
      <AdminHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
        <h1 className="text-2xl font-bold">Eventos</h1>
        <section className="card bg-base-200">
          <div className="card-body gap-4">
            <h2 className="card-title">Novo evento</h2>
            <NewEventForm />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Eventos</h2>
          {events.length === 0 ? (
            <p className="text-base-content/70">Nenhum evento ainda.</p>
          ) : (
            <ul className="list rounded-box bg-base-200">
              {events.map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/admin/e/${event.code}`}
                    className="list-row items-center hover:bg-base-300"
                  >
                    <span className="font-mono text-xl font-bold tracking-widest text-primary">
                      {event.code}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{event.name}</div>
                      <div className="text-sm text-base-content/70">
                        {formatEventDate(event.date)}
                      </div>
                    </div>
                    <EventStatusBadge status={event.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
