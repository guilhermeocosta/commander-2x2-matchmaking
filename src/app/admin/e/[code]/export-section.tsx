import type { EventRow } from "@/db/schema";

import { ExportAdmin } from "./export-admin";

/** "Exportar": the updated season file for the site, once the event is finished. */
export function ExportSection({ event }: { event: EventRow }) {
  const finished = event.status === "finished";
  return (
    <section id="exportar" className="card bg-base-200">
      <div className="card-body gap-3">
        <h2 className="card-title">Exportar</h2>
        <p className="text-sm text-base-content/70">
          Gera o leaderboard.json do Hall da Fama com os resultados deste evento, a partir do
          arquivo atual do site.
        </p>
        {finished ? (
          <ExportAdmin code={event.code} />
        ) : (
          <>
            <button type="button" className="btn btn-block sm:btn-wide" disabled>
              Gerar arquivo
            </button>
            <p className="text-sm text-base-content/70">
              Disponível quando o evento for encerrado.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
