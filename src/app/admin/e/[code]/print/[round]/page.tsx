import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { getEventByCode, getRoundState, listEventPlayers } from "@/db/queries";
import { requireAdmin } from "@/lib/auth";

import { formatEventDate } from "../../../../ui";
import { roundStatusLabels, seatLabel, tableTitle, turnOrder } from "../../round-copy";
import { nameLookup } from "../../rounds-section";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Imprimir rodada · Admin · Commander 2x2" };

// Check the session before rendering anything, so logged-out visits get a real 307.
export const instant = false;

const roundParam = z.coerce.number().int().min(1).max(10);

/**
 * Printable pairings for one round: every table with its seats, then players A–Z with their
 * table, for the wall. Dark on screen; the print CSS (globals.css) switches to black on white.
 */
export default async function PrintRoundPage({
  params,
}: PageProps<"/admin/e/[code]/print/[round]">) {
  await requireAdmin();
  const { code, round } = await params;
  const number = roundParam.safeParse(round);
  if (!number.success) notFound();
  const event = await getEventByCode(code);
  if (!event) notFound();
  const [state, players] = await Promise.all([
    getRoundState(event.id, number.data),
    listEventPlayers(event.id),
  ]);
  if (!state) notFound();

  const name = nameLookup(players);
  const index = state.tables
    .flatMap(({ row, record }) =>
      record.seats.map((s) => ({
        name: name(s.playerId),
        where: row.kind === "bye" ? "Bye" : `${tableTitle(row.kind, row.number)} · ${seatLabel(s)}`,
      }))
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const isDraft = state.round.status === "draft";

  return (
    <main className="print-page mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link
          href={`/admin/e/${event.code}#rodadas`}
          className="link link-hover text-sm text-base-content/70"
        >
          ← Voltar ao evento
        </Link>
        <span className="flex-1" />
        <PrintButton />
      </div>

      {isDraft && (
        <div role="status" className="alert alert-warning alert-soft text-sm print:hidden">
          Esta rodada ainda é um rascunho ({roundStatusLabels.draft.toLowerCase()}): publique antes
          de imprimir a versão final.
        </div>
      )}

      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">Rodada {state.round.number}</h1>
        <p className="text-base-content/70 print:text-black">
          {event.name} · {formatEventDate(event.date)} · código {event.code}
          {isDraft && " · RASCUNHO"}
        </p>
      </header>

      <ol className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
        {state.tables.map(({ row, record }) => (
          <li
            key={row.id}
            className="print-avoid-break rounded-box border border-base-300 p-3 print:border-black"
          >
            <h2 className="mb-2 text-xl font-bold">{tableTitle(row.kind, row.number)}</h2>
            <ul className="flex flex-col gap-1 text-lg">
              {turnOrder(record.seats).map((s) => (
                <li key={seatLabel(s)} className="flex gap-3">
                  {row.kind !== "bye" && (
                    <span className="w-8 shrink-0 font-mono font-bold">{seatLabel(s)}</span>
                  )}
                  <span className="min-w-0 break-words">{name(s.playerId)}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <p className="text-sm text-base-content/70 print:text-black">
        Ordem dos turnos: A1, B1, A2, B2. Duplas: A1 + A2 contra B1 + B2.
      </p>

      <section className="print-break-before flex flex-col gap-2">
        <h2 className="text-xl font-bold">Jogadores de A a Z</h2>
        <ul className="columns-1 gap-6 text-base sm:columns-2 print:columns-2">
          {index.map((entry, i) => (
            <li
              key={i}
              className="flex justify-between gap-3 border-b border-base-300 py-1 break-inside-avoid print:border-black"
            >
              <span className="min-w-0 break-words">{entry.name}</span>
              <span className="whitespace-nowrap font-mono">{entry.where}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
