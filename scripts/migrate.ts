/**
 * Applies pending migrations from src/db/migrations (`pnpm db:migrate`). Uses the WebSocket
 * driver because the Neon HTTP driver can't run them in one transaction. Already-applied
 * migrations are skipped, so running it twice is a no-op.
 */
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

import { requireDatabaseUrl } from "./db-guard.ts";

const pool = new Pool({ connectionString: requireDatabaseUrl("db:migrate") });
try {
  await migrate(drizzle({ client: pool }), { migrationsFolder: "src/db/migrations" });
  console.log("db:migrate: up to date.");
} catch (error) {
  // Print only the message: the error object can carry connection details.
  console.error("db:migrate failed:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
} finally {
  await pool.end();
}
