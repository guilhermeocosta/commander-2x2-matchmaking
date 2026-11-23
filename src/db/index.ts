import "server-only";

import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import { getSql } from "../lib/db.ts";
import * as schema from "./schema.ts";

export type Db = NeonHttpDatabase<typeof schema>;

let cached: Db | undefined;

/**
 * The Drizzle client over the Neon HTTP driver, built on the same `DATABASE_URL` client as
 * /api/health. Throws when `DATABASE_URL` is unset; the message never includes the URL.
 * Neon HTTP has no interactive transactions: use `db.batch([...])` for writes that must land
 * together.
 */
export function getDb(): Db {
  if (cached) return cached;
  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL is not set");
  cached = drizzle({ client: sql, schema });
  return cached;
}

export { schema };
