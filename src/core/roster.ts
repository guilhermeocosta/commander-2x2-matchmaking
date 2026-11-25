/**
 * The season roster: the players listed in the site's `leaderboard.json`. Only `id` and `name`
 * are read. The file is external data, so every entry is validated and bad ones are dropped.
 */
import { z } from "zod";

export interface RosterEntry {
  /** Season player id, kebab-case (e.g. `guilherme-costa`). Stored as `event_players.roster_id`. */
  id: string;
  name: string;
}

export const rosterIdSchema = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

const entrySchema = z.object({
  id: rosterIdSchema,
  name: z.string().trim().min(1).max(60),
});

const fileSchema = z.object({ players: z.array(z.unknown()).max(2000) });

/**
 * Parses a `leaderboard.json` body into roster entries, sorted by name (pt-BR). Invalid entries
 * and duplicate ids are skipped; anything that isn't a leaderboard at all yields an empty roster.
 */
export function parseRoster(json: unknown): RosterEntry[] {
  const file = fileSchema.safeParse(json);
  if (!file.success) return [];
  const seen = new Set<string>();
  const entries: RosterEntry[] = [];
  for (const raw of file.data.players) {
    const entry = entrySchema.safeParse(raw);
    if (!entry.success || seen.has(entry.data.id)) continue;
    seen.add(entry.data.id);
    entries.push({ id: entry.data.id, name: entry.data.name });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Lowercase, accents removed, spaces collapsed: "  Cláudio  " → "claudio". For search only. */
export function searchKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Entries whose name contains every word of the query (accent- and case-insensitive). */
export function filterRoster<T extends RosterEntry>(entries: T[], query: string): T[] {
  const words = searchKey(query).split(" ").filter(Boolean);
  if (words.length === 0) return entries;
  return entries.filter((entry) => {
    const key = searchKey(entry.name);
    return words.every((word) => key.includes(word));
  });
}
