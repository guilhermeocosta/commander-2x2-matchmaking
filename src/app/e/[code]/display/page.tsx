import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getEventByCode } from "@/db/queries";
import { loadEventState } from "@/lib/event-state";

import { DisplayBoard } from "./display-board";

export const metadata: Metadata = { title: "Telão · Commander 2x2" };

// Live data with the server's clock: always rendered per request.
export const instant = false;

/** The projector view: every table and a big timer. Public, no login. */
export default async function DisplayPage({ params }: PageProps<"/e/[code]/display">) {
  const { code } = await params;
  const event = await getEventByCode(code);
  if (!event) notFound();
  return <DisplayBoard code={event.code} initial={await loadEventState(event)} />;
}
