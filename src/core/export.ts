/**
 * Season export: applies one finished event to the site's `leaderboard.json` (see "Season export"
 * in docs/rules.md). Pure: the caller fetches the file and the event's rounds.
 */
import { z } from "zod";

import { playerResults } from "./results.ts";
import { record } from "./standings.ts";
import type { PlayerId, RoundRecord } from "./types.ts";

// --- Copy of the site's schema (guilhermeocosta/commander-2x2, src/schemas/leaderboard.ts) ---
// Kept strict on purpose: if the site adds or renames a field, the export fails loudly instead
// of silently dropping data. Update this copy when the site's schema changes.

const IsoDate = z.iso.date();
const HttpsUrl = z.url({ protocol: /^https$/ });

export const playerStatsSchema = z.strictObject({
  eventsAttended: z.number().int().min(0),
  wins: z.number().int().min(0),
  draws: z.number().int().min(0),
  losses: z.number().int().min(0),
});

export const leaderboardPlayerSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  avatar: HttpsUrl.nullable(),
  stats: playerStatsSchema,
  tiebreakRoll: z.number().int().min(1).optional(),
});

export const leaderboardSchema = z.strictObject({
  updatedAt: IsoDate,
  year: z.number().int(),
  players: z.array(leaderboardPlayerSchema).superRefine((players, ctx) => {
    const seen = new Set<string>();
    players.forEach((p, index) => {
      if (seen.has(p.id)) {
        ctx.addIssue({ code: "custom", message: `Duplicate id: ${p.id}`, path: [index, "id"] });
      }
      seen.add(p.id);
    });
  }),
});

export type Leaderboard = z.infer<typeof leaderboardSchema>;
export type LeaderboardPlayer = z.infer<typeof leaderboardPlayerSchema>;

// --- Event results ---

/** One attending player's line for the export. */
export interface EventResult {
  /** Season id (`event_players.roster_id`), or null for a player not matched to the roster. */
  rosterId: string | null;
  name: string;
  /** Byes counted as wins. */
  wins: number;
  draws: number;
  losses: number;
}

export interface ExportPlayer {
  id: PlayerId;
  displayName: string;
  rosterId: string | null;
  joinedRound: number;
  droppedAfterRound: number | null;
}

/**
 * The export lines of an event: every player due to play at least one of its `roundCount`
 * rounds (late joiners and dropped players included), with W/D/L from the rounds they actually
 * played. A player who left before their first round, or joined after the last, did not attend.
 */
export function eventResults(
  players: readonly ExportPlayer[],
  rounds: readonly RoundRecord[],
  roundCount: number
): EventResult[] {
  const byPlayer = playerResults(rounds);
  return players
    .filter((p) => p.joinedRound <= Math.min(p.droppedAfterRound ?? roundCount, roundCount))
    .map((p) => {
      const { wins, draws, losses } = record(byPlayer[p.id] ?? []);
      return { rosterId: p.rosterId, name: p.displayName, wins, draws, losses };
    });
}

/** Players with 2 or more wins (byes included) must publish their decklist; most wins first. */
export function decklistsToCollect(results: readonly EventResult[]): EventResult[] {
  return results
    .filter((r) => r.wins >= 2)
    .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name, "pt-BR"));
}

// --- Applying the event ---

const MAX_ID_LENGTH = 80;

/** "José  da Silva!" → "jose-da-silva". Falls back to "jogador" when nothing is left. */
export function kebabId(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_ID_LENGTH)
    .replace(/-+$/, "");
  return slug || "jogador";
}

/** `base`, or `base-2`, `base-3`… the first one not in `taken`. */
function uniqueId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const id = `${base}-${n}`;
    if (!taken.has(id)) return id;
  }
}

export interface NewPlayer {
  id: string;
  name: string;
  /** Why it's new: no roster match, or a roster id that is no longer in the file. */
  reason: "unmatched" | "missing-roster-id";
}

export interface ExportResult {
  leaderboard: Leaderboard;
  /** Players appended to the file, to review before committing it. */
  newPlayers: NewPlayer[];
}

/**
 * The leaderboard after the event. Each attending player gets +1 `eventsAttended` and their
 * W/D/L added; players matched by `rosterId` are updated in place and the rest are appended with
 * a unique kebab-case id and `avatar: null`. Order, `tiebreakRoll` and every untouched player
 * object are kept as they are; `updatedAt` becomes `eventDate`.
 *
 * Throws a ZodError when the input or the output doesn't match the site's schema, and an Error
 * when two results share a roster id.
 */
export function applyEventToLeaderboard(
  leaderboard: unknown,
  results: readonly EventResult[],
  eventDate: string
): ExportResult {
  // Validate, but keep the caller's objects: Zod rebuilds them in schema key order, and untouched
  // players must serialize exactly as they came in. The schema is strict and has no transforms,
  // so a value that parses is already a `Leaderboard`.
  leaderboardSchema.parse(leaderboard);
  const input = leaderboard as Leaderboard;
  const byRosterId = new Map<string, EventResult>();
  const unmatched: EventResult[] = [];
  const known = new Set(input.players.map((p) => p.id));

  for (const r of results) {
    if (r.rosterId !== null && known.has(r.rosterId)) {
      if (byRosterId.has(r.rosterId)) throw new Error(`Two players share roster id ${r.rosterId}`);
      byRosterId.set(r.rosterId, r);
    } else {
      unmatched.push(r);
    }
  }

  const players: LeaderboardPlayer[] = input.players.map((player) => {
    const r = byRosterId.get(player.id);
    if (!r) return player;
    const { stats } = player;
    return {
      ...player,
      stats: {
        ...stats,
        eventsAttended: stats.eventsAttended + 1,
        wins: stats.wins + r.wins,
        draws: stats.draws + r.draws,
        losses: stats.losses + r.losses,
      },
    };
  });

  const taken = new Set(known);
  const newPlayers: NewPlayer[] = [];
  for (const r of unmatched) {
    // A roster id that left the file keeps its id when free, so the player stays the same person.
    const id = uniqueId(r.rosterId ?? kebabId(r.name), taken);
    taken.add(id);
    newPlayers.push({ id, name: r.name, reason: r.rosterId ? "missing-roster-id" : "unmatched" });
    players.push({
      id,
      name: r.name,
      avatar: null,
      stats: { eventsAttended: 1, wins: r.wins, draws: r.draws, losses: r.losses },
    });
  }

  const output: Leaderboard = { ...input, updatedAt: eventDate, players };
  leaderboardSchema.parse(output);
  return { leaderboard: output, newPlayers };
}

/** The file as the site's Prettier writes it: 2-space indent and a trailing newline. */
export function formatLeaderboard(leaderboard: Leaderboard): string {
  return `${JSON.stringify(leaderboard, null, 2)}\n`;
}
