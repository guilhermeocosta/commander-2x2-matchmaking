import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getEventByCode } from "@/db/queries";

import { ClaimForm } from "./claim-form";

export const metadata: Metadata = {
  title: "Entrar neste aparelho · Commander 2x2",
  // The token lives in the URL fragment, which browsers never send; this is belt and braces.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export const instant = false;

/**
 * Target of a reissued link (`/e/CODE/entrar#<token>`). The token is in the fragment, so it
 * never reaches the server in a GET (logs, link previews); the player confirms with a button,
 * which posts it to a Server Action.
 */
export default async function ClaimPage({ params }: PageProps<"/e/[code]/entrar">) {
  const { code } = await params;
  const event = await getEventByCode(code);
  if (!event) notFound();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-1">
        <span className="font-mono text-sm font-bold tracking-widest text-primary">
          {event.code}
        </span>
        <h1 className="text-2xl font-bold break-words">{event.name}</h1>
      </header>
      <section className="card bg-base-200">
        <div className="card-body gap-4">
          <h2 className="card-title">Entrar neste aparelho</h2>
          <p className="text-base-content/70">
            Este link foi gerado pela organização para você continuar o evento neste aparelho. Ele
            funciona uma única vez.
          </p>
          <ClaimForm code={event.code} />
        </div>
      </section>
    </main>
  );
}
