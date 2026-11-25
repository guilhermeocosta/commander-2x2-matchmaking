import { describe, expect, it } from "vitest";

import {
  allowedTimerActions,
  applyTimerAction,
  bestOffset,
  elapsedMs,
  extraTurns,
  formatClock,
  sampleOffset,
  timerView,
  type TimerAction,
  type TimerFields,
} from "./timer.ts";

const MIN = 60_000;
const T0 = Date.UTC(2026, 11, 12, 14, 0, 0);

const published: TimerFields = {
  status: "published",
  startedAt: null,
  pausedAt: null,
  elapsedBeforePauseSec: 0,
  durationSec: 50 * 60,
};

/** Applies a control and fails the test if it's refused. */
function act(t: TimerFields, action: TimerAction, now: number): TimerFields {
  const change = applyTimerAction(t, action, now);
  if (!change.ok) throw new Error(`${action} refused`);
  return change.next;
}

describe("timerView", () => {
  it("shows the full time before the round starts", () => {
    expect(timerView(published, T0)).toEqual({
      status: "published",
      remainingSec: 3000,
      overtime: false,
      paused: false,
    });
    expect(formatClock(timerView(published, T0).remainingSec)).toBe("50:00");
  });

  it("counts down while running, rounding up", () => {
    const t = act(published, "start", T0);
    expect(timerView(t, T0).remainingSec).toBe(3000);
    expect(timerView(t, T0 + 1).remainingSec).toBe(3000);
    expect(timerView(t, T0 + 1000).remainingSec).toBe(2999);
    expect(formatClock(timerView(t, T0 + 10 * MIN + 500).remainingSec)).toBe("40:00");
  });

  it("switches to overtime at 0", () => {
    const t = act(published, "start", T0);
    expect(timerView(t, T0 + 50 * MIN - 1)).toMatchObject({ remainingSec: 1, overtime: false });
    expect(timerView(t, T0 + 50 * MIN)).toEqual({
      status: "overtime",
      remainingSec: 0,
      overtime: true,
      paused: false,
    });
    expect(timerView(t, T0 + 70 * MIN).remainingSec).toBe(0);
  });

  it("freezes while paused and continues after resume", () => {
    let t = act(published, "start", T0);
    t = act(t, "pause", T0 + 10 * MIN + 400);
    expect(t).toMatchObject({ status: "paused", elapsedBeforePauseSec: 600 });
    expect(timerView(t, T0 + 30 * MIN)).toMatchObject({
      status: "paused",
      remainingSec: 2400,
      paused: true,
    });
    t = act(t, "resume", T0 + 30 * MIN);
    expect(t.status).toBe("running");
    expect(timerView(t, T0 + 40 * MIN).remainingSec).toBe(1800);
    expect(timerView(t, T0 + 70 * MIN).overtime).toBe(true);
  });

  it("ignores a client clock behind the start", () => {
    const t = act(published, "start", T0);
    expect(elapsedMs(t, T0 - 5000)).toBe(0);
  });

  it("keeps a closed round's clock out of the way", () => {
    const t = { ...act(published, "start", T0), status: "closed" as const };
    expect(timerView(t, T0 + 80 * MIN)).toMatchObject({ status: "closed", overtime: false });
  });
});

describe("applyTimerAction", () => {
  it("only starts a published round", () => {
    expect(applyTimerAction({ ...published, status: "draft" }, "start", T0).ok).toBe(false);
    const running = act(published, "start", T0);
    expect(applyTimerAction(running, "start", T0).ok).toBe(false);
    expect(allowedTimerActions(published, T0)).toEqual(["start"]);
  });

  it("lists the controls per status", () => {
    const running = act(published, "start", T0);
    expect(allowedTimerActions(running, T0 + MIN)).toEqual(["pause", "add5"]);
    const paused = act(running, "pause", T0 + MIN);
    expect(allowedTimerActions(paused, T0 + 2 * MIN)).toEqual(["resume", "add5"]);
    expect(allowedTimerActions(running, T0 + 60 * MIN)).toEqual(["pause", "add5"]);
    expect(allowedTimerActions({ ...running, status: "closed" }, T0)).toEqual([]);
  });

  it("adds 5 minutes while running", () => {
    let t = act(published, "start", T0);
    t = act(t, "add5", T0 + 10 * MIN);
    expect(t).toMatchObject({ status: "running", durationSec: 55 * 60 });
    expect(timerView(t, T0 + 10 * MIN).remainingSec).toBe(45 * 60);
  });

  it("adds 5 minutes while paused, staying paused", () => {
    let t = act(published, "start", T0);
    t = act(t, "pause", T0 + 10 * MIN);
    t = act(t, "add5", T0 + 20 * MIN);
    expect(t).toMatchObject({ status: "paused", durationSec: 55 * 60 });
    expect(timerView(t, T0 + 20 * MIN).remainingSec).toBe(45 * 60);
  });

  it("gives 5 minutes from now in overtime", () => {
    let t = act(published, "start", T0);
    expect(timerView(t, T0 + 52 * MIN).overtime).toBe(true);
    t = act(t, "add5", T0 + 52 * MIN);
    expect(t.status).toBe("running");
    expect(timerView(t, T0 + 52 * MIN)).toMatchObject({ remainingSec: 300, overtime: false });
    expect(timerView(t, T0 + 57 * MIN).overtime).toBe(true);
  });

  it("pauses and resumes in overtime", () => {
    let t = act(published, "start", T0);
    t = act(t, "pause", T0 + 51 * MIN);
    expect(timerView(t, T0 + 55 * MIN)).toMatchObject({ status: "paused", overtime: true });
    t = act(t, "resume", T0 + 55 * MIN);
    expect(t.status).toBe("overtime");
  });

  it("refuses resume when not paused and pause when paused", () => {
    const running = act(published, "start", T0);
    expect(applyTimerAction(running, "resume", T0 + MIN).ok).toBe(false);
    const paused = act(running, "pause", T0 + MIN);
    expect(applyTimerAction(paused, "pause", T0 + 2 * MIN).ok).toBe(false);
  });
});

describe("formatClock", () => {
  it("pads minutes and seconds", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(75 * 60)).toBe("75:00");
    expect(formatClock(-3)).toBe("00:00");
  });
});

describe("extraTurns", () => {
  it("gives 3 at 2v2 tables and 5 at the 1v1", () => {
    expect(extraTurns("2v2")).toBe(3);
    expect(extraTurns("1v1")).toBe(5);
    expect(extraTurns("bye")).toBeNull();
  });
});

describe("clock offset", () => {
  it("uses the round trip's midpoint", () => {
    expect(sampleOffset({ sentAt: 1000, receivedAt: 1200, serverNow: 6100 })).toBe(5000);
  });

  it("prefers the shortest round trip", () => {
    const offset = bestOffset([
      { sentAt: 0, receivedAt: 2000, serverNow: 9000 },
      { sentAt: 5000, receivedAt: 5100, serverNow: 4050 },
    ]);
    expect(offset).toBe(-1000);
    expect(bestOffset([])).toBe(0);
  });
});
