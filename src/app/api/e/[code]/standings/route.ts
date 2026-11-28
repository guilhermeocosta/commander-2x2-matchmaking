import { connection } from "next/server";

import { getEventByCode } from "@/db/queries";
import { loadStandings } from "@/lib/standings";

const noStore = { "Cache-Control": "no-store" };

/**
 * The public standings after the last closed round (`{ standings: null }` before round 1
 * closes). Fetched by the live pages when a round closes, not on every poll, to keep the state
 * snapshot small.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/e/[code]/standings">) {
  await connection();
  const { code } = await ctx.params;
  try {
    // getEventByCode validates the code (Zod) and returns undefined for anything malformed.
    const event = await getEventByCode(code);
    if (!event) {
      return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
    }
    return Response.json({ standings: await loadStandings(event) }, { headers: noStore });
  } catch {
    // Don't return the error: it can contain connection details.
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
