import type { Seat, TableKind } from "@/core/types";

import { pointsLabel, seatLabel, tableTitle, turnOrder } from "./round-copy";

/** One table as shown to the admin, with display names already resolved. */
export interface TableView {
  number: number;
  kind: TableKind;
  seats: (Seat & { name: string; points: number })[];
}

const teamBadge = { A: "badge-primary", B: "badge-info" } as const;

/** The tables of a round, as cards. Teams are color-coded; seats are in turn order. */
export function RoundTables({ tables }: { tables: readonly TableView[] }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2">
      {tables.map((table) => (
        <li key={table.number} className="rounded-box bg-base-100 p-3">
          <h3 className="mb-2 font-bold">{tableTitle(table.kind, table.number)}</h3>
          <ul className="flex flex-col gap-1.5">
            {turnOrder(table.seats).map((seat) => (
              <li key={seatLabel(seat)} className="flex items-center gap-2">
                {table.kind !== "bye" && (
                  <span className={`badge badge-sm w-8 font-mono ${teamBadge[seat.team]}`}>
                    {seatLabel(seat)}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">{seat.name}</span>
                <span className="text-sm whitespace-nowrap text-base-content/60">
                  {pointsLabel(seat.points)}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
