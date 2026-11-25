import { connection } from "next/server";

import { getEventByCode } from "@/db/queries";
import { loadEventState } from "@/lib/event-state";

const noStore = { "Cache-Control": "no-store" };

/**
 * The live snapshot polled by the player, display and admin pages (see src/core/event-state.ts).
 * Public data plus the caller's own seat. Never cached: the timer needs the server's `now`.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/e/[code]/state">) {
  await connection();
  const { code } = await ctx.params;
  try {
    // getEventByCode validates the code (Zod) and returns undefined for anything malformed.
    const event = await getEventByCode(code);
    if (!event) {
      return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
    }
    return Response.json(await loadEventState(event), { headers: noStore });
  } catch {
    // Don't return the error: it can contain connection details.
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
