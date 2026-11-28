/**
 * The live snapshot that `GET /api/e/[code]/state` returns and the player, display and admin
 * pages poll. Plain JSON. Public data only (event, the current published round, display names at
 * its tables), plus the caller's own seat when their device cookie matches a player.
 */
import { resultStatus, type ResultStatus } from "./report.ts";
import type { EventStatus } from "./rounds.ts";
import { liveStatus, type TimerFields } from "./timer.ts";
import type { OneVsOneGames, Outcome, SeatPosition, TableKind, Team } from "./types.ts";

export interface LiveSeat {
  team: Team;
  position: SeatPosition;
  name: string;
}

/** A table's result as shown to everyone. Results are public at the store anyway. */
export interface LiveResult {
  status: ResultStatus;
  outcome: Outcome | null;
  /** 1v1 only, when reported with games. */
  games: OneVsOneGames | null;
  /** Display name of the seated player who reported; null when unreported or set by the admin. */
  reportedBy: string | null;
}

export interface LiveTable {
  number: number;
  kind: TableKind;
  /** Sorted A1, A2, B1, B2. */
  seats: LiveSeat[];
  /** Null for a bye. */
  result: LiveResult | null;
}

export interface LiveRound extends TimerFields {
  number: number;
  tables: LiveTable[];
}

export interface LiveMe {
  name: string;
  joinedRound: number;
  dropped: boolean;
  /** Where the caller sits in the current round, if they play it. */
  seat: { table: number; team: Team; position: SeatPosition } | null;
}

export interface EventState {
  /** The server's clock (epoch ms) when the snapshot was built. */
  now: number;
  event: { code: string; name: string; status: EventStatus; rounds: number };
  /** The latest published (or later) round; drafts are never included. */
  round: LiveRound | null;
  me: LiveMe | null;
}

/** A stored round with its seats, player ids resolved to names on the server. */
export interface StoredLiveRound extends TimerFields {
  number: number;
  tables: {
    number: number;
    kind: TableKind;
    seats: { playerId: string; name: string; team: Team; position: SeatPosition }[];
    outcome: Outcome | null;
    gamesA: number | null;
    gamesB: number | null;
    /** Player id of the reporter. */
    reportedBy: string | null;
    overridden: boolean;
  }[];
}

function liveResult(table: StoredLiveRound["tables"][number]): LiveResult | null {
  if (table.kind === "bye") return null;
  const reporter = table.seats.find((s) => s.playerId === table.reportedBy);
  return {
    status: resultStatus(table),
    outcome: table.outcome,
    games:
      table.kind === "1v1" && table.gamesA !== null && table.gamesB !== null
        ? { a: table.gamesA, b: table.gamesB }
        : null,
    reportedBy: reporter?.name ?? null,
  };
}

const seatOrder = (a: LiveSeat, b: LiveSeat) =>
  a.team.localeCompare(b.team) || a.position - b.position;

/**
 * Builds the snapshot. Drops a draft round, strips player ids, and finds the caller's seat by
 * their player id. The round's status is the live one (a `running` round past its time reads
 * `overtime`).
 */
export function buildEventState(input: {
  now: number;
  event: EventState["event"];
  round: StoredLiveRound | null;
  me: {
    id: string;
    displayName: string;
    joinedRound: number;
    droppedAfterRound: number | null;
  } | null;
}): EventState {
  const { now, event, me } = input;
  const stored = input.round && input.round.status !== "draft" ? input.round : null;

  let seat: LiveMe["seat"] = null;
  const round: LiveRound | null = stored && {
    number: stored.number,
    status: liveStatus(stored, now),
    startedAt: stored.startedAt,
    pausedAt: stored.pausedAt,
    elapsedBeforePauseSec: stored.elapsedBeforePauseSec,
    durationSec: stored.durationSec,
    tables: stored.tables.map((t) => ({
      number: t.number,
      kind: t.kind,
      seats: t.seats
        .map((s) => {
          if (me && s.playerId === me.id) {
            seat = { table: t.number, team: s.team, position: s.position };
          }
          return { team: s.team, position: s.position, name: s.name };
        })
        .sort(seatOrder),
      result: liveResult(t),
    })),
  };

  return {
    now,
    event,
    round,
    me: me && {
      name: me.displayName,
      joinedRound: me.joinedRound,
      dropped: me.droppedAfterRound !== null,
      seat,
    },
  };
}

/** The caller's table, teammate and opponents, for the player view. */
export function mySeatView(state: EventState) {
  const seat = state.me?.seat;
  const table = seat && state.round?.tables.find((t) => t.number === seat.table);
  if (!seat || !table) return null;
  const mine = table.seats.find((s) => s.team === seat.team && s.position === seat.position);
  return {
    table,
    seat,
    teammate: table.seats.find((s) => s.team === seat.team && s !== mine) ?? null,
    opponents: table.seats.filter((s) => s.team !== seat.team),
  };
}
