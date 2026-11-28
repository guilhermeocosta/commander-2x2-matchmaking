import { omwLabel, recordLabel, type EventStandings } from "@/core/event-standings";

/**
 * The event standings as a table: rank, name, points, V-E-D and OMW%. Used by the player tab,
 * the admin panel and the display. `highlight` marks the viewer's own row by display name.
 */
export function StandingsTable({
  standings,
  highlight,
  className = "",
}: {
  standings: EventStandings | null;
  highlight?: string;
  className?: string;
}) {
  if (!standings) {
    return (
      <p className="text-base-content/70" role="status">
        A classificação aparece quando a rodada 1 fechar.
      </p>
    );
  }
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="table table-sm table-zebra">
        <caption className="pb-2 text-left text-sm text-base-content/70">
          Após a rodada {standings.throughRound}
        </caption>
        <thead>
          <tr>
            <th className="w-px px-1.5 text-right">#</th>
            <th className="w-full px-1.5">Jogador</th>
            <th className="w-px px-1.5 text-right">Pts</th>
            <th
              className="w-px px-1.5 text-center whitespace-nowrap"
              title="Vitórias-Empates-Derrotas"
            >
              V-E-D
            </th>
            <th className="w-px px-1.5 text-right" title="% de vitórias dos oponentes">
              OMW%
            </th>
          </tr>
        </thead>
        <tbody>
          {standings.rows.map((row) => {
            const mine = highlight !== undefined && row.name === highlight;
            return (
              <tr key={row.rank} className={mine ? "bg-primary/15 font-bold" : ""}>
                <td className="px-1.5 text-right font-mono tabular-nums">{row.rank}</td>
                <td className="max-w-0 truncate px-1.5" title={row.name}>
                  {row.name}
                  {row.dropped && (
                    <span className="ml-1 text-xs font-normal text-base-content/60">(saiu)</span>
                  )}
                </td>
                <td className="px-1.5 text-right font-mono font-bold tabular-nums">{row.points}</td>
                <td className="px-1.5 text-center font-mono whitespace-nowrap tabular-nums">
                  {recordLabel(row)}
                </td>
                <td className="px-1.5 text-right font-mono whitespace-nowrap tabular-nums">
                  {omwLabel(row.omw)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
