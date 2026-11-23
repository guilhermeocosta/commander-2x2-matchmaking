import { connection } from "next/server";

import { getSql } from "@/lib/db";

const noStore = { "Cache-Control": "no-store" };

/**
 * Health check: { ok: true, db: "up" } when `select 1` succeeds, else HTTP 503.
 * With Cache Components on, `connection()` keeps this out of prerendering so it
 * runs on every request; `no-store` keeps CDNs and browsers from caching it.
 */
export async function GET() {
  await connection();

  const sql = getSql();
  if (sql) {
    try {
      await sql`select 1`;
      return Response.json({ ok: true, db: "up" }, { headers: noStore });
    } catch {
      // Don't log or return the error: it can contain connection details.
    }
  }

  return Response.json({ ok: false, db: "down" }, { status: 503, headers: noStore });
}
