import "server-only";

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Returns a Neon SQL tag bound to DATABASE_URL, or null when it isn't set.
 * The connection string is a secret: this module must only run on the server.
 */
export function getSql(): NeonQueryFunction<false, false> | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}
