import "server-only";

import { cacheLife } from "next/cache";

import { parseRoster, type RosterEntry } from "@/core/roster";

/** The site's season ranking; see "Identity and security" in docs/architecture.md. */
export const ROSTER_URL =
  "https://raw.githubusercontent.com/guilhermeocosta/commander-2x2/main/src/data/leaderboard.json";

const TIMEOUT_MS = 5000;
const MAX_BYTES = 1_000_000;

/**
 * Fetches and parses the roster, cached for 1 hour. Throws on any failure (network, status,
 * size, empty result) so a failure is never cached: the next request tries again.
 */
async function fetchRoster(): Promise<RosterEntry[]> {
  "use cache";
  cacheLife({ stale: 5 * 60, revalidate: 60 * 60, expire: 24 * 60 * 60 });

  const res = await fetch(ROSTER_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Roster fetch failed with HTTP ${res.status}`);
  const body = await res.text();
  if (body.length > MAX_BYTES) throw new Error("Roster is too large");
  const roster = parseRoster(JSON.parse(body));
  if (roster.length === 0) throw new Error("Roster is empty");
  return roster;
}

/** The season roster, or an empty one when it can't be loaded (joining by name still works). */
export async function getRoster(): Promise<RosterEntry[]> {
  try {
    return await fetchRoster();
  } catch {
    return [];
  }
}
