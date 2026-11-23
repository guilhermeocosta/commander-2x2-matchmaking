import Link from "next/link";

import type { EventRow } from "@/db/schema";

import { logoutAction } from "./actions";

/** "2026-12-12" → "12/12/2026", without going through a time zone. */
export function formatEventDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

const statusLabels: Record<EventRow["status"], string> = {
  open: "Aberto",
  running: "Em andamento",
  finished: "Encerrado",
};

const statusClasses: Record<EventRow["status"], string> = {
  open: "badge-info",
  running: "badge-success",
  finished: "badge-neutral",
};

export function EventStatusBadge({ status }: { status: EventRow["status"] }) {
  return <span className={`badge badge-sm ${statusClasses[status]}`}>{statusLabels[status]}</span>;
}

/** Top bar for logged-in admin pages. */
export function AdminHeader() {
  return (
    <header className="navbar gap-2 border-b border-base-300 bg-base-200 px-4">
      <Link href="/admin" className="flex-1 text-lg font-bold text-primary">
        Commander 2x2 · Admin
      </Link>
      <form action={logoutAction}>
        <button type="submit" className="btn btn-ghost btn-sm">
          Sair
        </button>
      </form>
    </header>
  );
}
