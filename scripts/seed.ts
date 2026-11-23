/**
 * Seeds a fake event for development (`pnpm db:seed`): code `TEST` with 13 players, enough for
 * three 2v2 tables and a bye. Idempotent: it only adds what is missing, so running it again
 * changes nothing. Never run it against the production branch.
 */
import { requireDatabaseUrl } from "./db-guard.ts";

requireDatabaseUrl("db:seed");

// Imported after the guard so a missing DATABASE_URL gets the friendly message.
const { getEventByCode, createEvent, listEventPlayers, addEventPlayer } =
  await import("../src/db/queries.ts");

const CODE = "TEST";
const PLAYER_COUNT = 13;
const names = Array.from(
  { length: PLAYER_COUNT },
  (_, i) => `Jogador Teste ${String(i + 1).padStart(2, "0")}`
);

try {
  const event =
    (await getEventByCode(CODE)) ??
    (await createEvent({ code: CODE, name: "Evento de teste", date: "2026-12-12" }));

  const existing = new Set((await listEventPlayers(event.id)).map((p) => p.displayName));
  const missing = names.filter((name) => !existing.has(name));
  // One at a time, so join order (created_at) follows the names.
  for (const displayName of missing) {
    await addEventPlayer({ eventId: event.id, displayName });
  }

  console.log(
    `db:seed: event ${CODE} ready with ${existing.size + missing.length} players ` +
      `(${missing.length} added).`
  );
} catch (error) {
  console.error("db:seed failed:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
}
