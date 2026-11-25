/**
 * The round timer. Every client computes the clock from the same stored fields, so phones, the
 * projector and the admin agree without the server pushing ticks.
 *
 * Stored fields (see `rounds` in docs/architecture.md):
 * - `startedAt`: when the current running stretch began (Iniciar, then each Retomar).
 * - `pausedAt`: when the clock was paused; null while it runs.
 * - `elapsedBeforePauseSec`: whole seconds run in the stretches before the current one.
 * - `durationSec`: the round's time; +5 min adds to it.
 *
 * Times are epoch milliseconds. Pass the server's clock (`Date.now() + offset` on a client).
 */
import type { RoundStatus } from "./rounds.ts";
import type { TableKind } from "./types.ts";

export interface TimerFields {
  status: RoundStatus;
  startedAt: number | null;
  pausedAt: number | null;
  elapsedBeforePauseSec: number;
  durationSec: number;
}

/** Statuses whose clock has started. */
const CLOCK_STATUSES: readonly RoundStatus[] = ["running", "paused", "overtime"];

export function hasClock(status: RoundStatus): boolean {
  return CLOCK_STATUSES.includes(status);
}

/** Milliseconds the clock has run. 0 before Iniciar. */
export function elapsedMs(t: TimerFields, nowMs: number): number {
  if (!hasClock(t.status)) return 0;
  const running =
    t.pausedAt === null && t.startedAt !== null ? Math.max(0, nowMs - t.startedAt) : 0;
  return t.elapsedBeforePauseSec * 1000 + running;
}

/**
 * The status as of `nowMs`. The stored status only changes on admin actions, so a `running`
 * round whose time ran out is `overtime` here until something writes it.
 */
export function liveStatus(t: TimerFields, nowMs: number): RoundStatus {
  if (!hasClock(t.status)) return t.status;
  if (t.pausedAt !== null) return "paused";
  return elapsedMs(t, nowMs) >= t.durationSec * 1000 ? "overtime" : "running";
}

export interface TimerView {
  status: RoundStatus;
  /** Whole seconds left, rounded up (so the clock reads 50:00 at the start); 0 in overtime. */
  remainingSec: number;
  /** True once the time ran out (also while paused after that). */
  overtime: boolean;
  paused: boolean;
}

export function timerView(t: TimerFields, nowMs: number): TimerView {
  const status = liveStatus(t, nowMs);
  const leftMs = t.durationSec * 1000 - elapsedMs(t, nowMs);
  return {
    status,
    remainingSec: Math.max(0, Math.ceil(leftMs / 1000)),
    overtime: hasClock(t.status) && leftMs <= 0,
    paused: status === "paused",
  };
}

/** "mm:ss" (minutes can pass 59: "75:00"). */
export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** Extra turns after the current one once time runs out (docs/rules.md, Time and extra turns). */
export function extraTurns(kind: TableKind): number | null {
  if (kind === "2v2") return 3;
  if (kind === "1v1") return 5;
  return null;
}

// ---------------------------------------------------------------------------------------------
// Admin controls

export type TimerAction = "start" | "pause" | "resume" | "add5";

export const ADD_TIME_SEC = 5 * 60;

export type TimerChange = { ok: true; next: TimerFields } | { ok: false; reason: "not-allowed" };

/**
 * What a control does to the stored fields at `nowMs`:
 * - Iniciar (`published`): the clock starts from 0.
 * - Pausar (`running` or `overtime`): the elapsed time is folded into `elapsedBeforePauseSec`.
 * - Retomar (`paused`): a new stretch starts now.
 * - +5 min (`running`, `paused` or `overtime`): 5 minutes more than now. In overtime that means
 *   5 minutes from now, not 5 minus the overtime already played.
 */
export function applyTimerAction(t: TimerFields, action: TimerAction, nowMs: number): TimerChange {
  const status = liveStatus(t, nowMs);
  const no: TimerChange = { ok: false, reason: "not-allowed" };

  switch (action) {
    case "start": {
      if (t.status !== "published") return no;
      return {
        ok: true,
        next: {
          status: "running",
          startedAt: nowMs,
          pausedAt: null,
          elapsedBeforePauseSec: 0,
          durationSec: t.durationSec,
        },
      };
    }
    case "pause": {
      if (status !== "running" && status !== "overtime") return no;
      return {
        ok: true,
        next: {
          ...t,
          status: "paused",
          pausedAt: nowMs,
          elapsedBeforePauseSec: Math.floor(elapsedMs(t, nowMs) / 1000),
        },
      };
    }
    case "resume": {
      if (status !== "paused") return no;
      const overtime = t.elapsedBeforePauseSec >= t.durationSec;
      return {
        ok: true,
        next: { ...t, status: overtime ? "overtime" : "running", startedAt: nowMs, pausedAt: null },
      };
    }
    case "add5": {
      if (status !== "running" && status !== "paused" && status !== "overtime") return no;
      const elapsedSec = Math.ceil(elapsedMs(t, nowMs) / 1000);
      const durationSec = Math.max(t.durationSec, elapsedSec) + ADD_TIME_SEC;
      return {
        ok: true,
        next: { ...t, durationSec, status: status === "paused" ? "paused" : "running" },
      };
    }
  }
}

/** Which controls the admin can use at `nowMs`. */
export function allowedTimerActions(t: TimerFields, nowMs: number): TimerAction[] {
  const actions: TimerAction[] = ["start", "pause", "resume", "add5"];
  return actions.filter((a) => applyTimerAction(t, a, nowMs).ok);
}

// ---------------------------------------------------------------------------------------------
// Clock offset

export interface ClockSample {
  /** Client clock when the request was sent and when the response arrived. */
  sentAt: number;
  receivedAt: number;
  /** The server's clock in the response. */
  serverNow: number;
}

/**
 * `serverNow - clientNow` from one round trip, assuming the server read its clock halfway
 * through. Add it to `Date.now()` to get the server's time.
 */
export function sampleOffset(s: ClockSample): number {
  return s.serverNow - (s.sentAt + s.receivedAt) / 2;
}

/** The offset from the sample with the shortest round trip (the least uncertain). */
export function bestOffset(samples: readonly ClockSample[]): number {
  if (samples.length === 0) return 0;
  let best = samples[0];
  for (const s of samples) {
    if (s.receivedAt - s.sentAt < best.receivedAt - best.sentAt) best = s;
  }
  return sampleOffset(best);
}
