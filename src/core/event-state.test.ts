import { describe, expect, it } from "vitest";

import { buildEventState, mySeatView, type StoredLiveRound } from "./event-state.ts";

const NOW = Date.UTC(2026, 11, 12, 14, 0, 0);
const event = { code: "TEST", name: "Teste", status: "running" as const, rounds: 3 };

function stored(overrides: Partial<StoredLiveRound> = {}): StoredLiveRound {
  return {
    number: 1,
    status: "published",
    startedAt: null,
    pausedAt: null,
    elapsedBeforePauseSec: 0,
    durationSec: 3000,
    tables: [
      {
        number: 1,
        kind: "2v2",
        seats: [
          { playerId: "p4", name: "Dora", team: "B", position: 2 },
          { playerId: "p1", name: "Ana", team: "A", position: 1 },
          { playerId: "p3", name: "Caio", team: "B", position: 1 },
          { playerId: "p2", name: "Bia", team: "A", position: 2 },
        ],
      },
      {
        number: 2,
        kind: "1v1",
        seats: [
          { playerId: "p5", name: "Eva", team: "A", position: 1 },
          { playerId: "p6", name: "Fábio", team: "B", position: 1 },
        ],
      },
      { number: 3, kind: "bye", seats: [{ playerId: "p7", name: "Gil", team: "A", position: 1 }] },
    ],
    ...overrides,
  };
}

const me = (id: string) => ({ id, displayName: "Eu", joinedRound: 1, droppedAfterRound: null });

describe("buildEventState", () => {
  it("never includes a draft round", () => {
    const state = buildEventState({
      now: NOW,
      event,
      round: stored({ status: "draft" }),
      me: null,
    });
    expect(state.round).toBeNull();
  });

  it("strips player ids and sorts seats", () => {
    const state = buildEventState({ now: NOW, event, round: stored(), me: null });
    expect(JSON.stringify(state)).not.toContain("p1");
    expect(state.round?.tables[0].seats.map((s) => s.name)).toEqual(["Ana", "Bia", "Caio", "Dora"]);
    expect(state.me).toBeNull();
  });

  it("finds the caller's own seat", () => {
    const state = buildEventState({ now: NOW, event, round: stored(), me: me("p3") });
    expect(state.me).toEqual({
      name: "Eu",
      joinedRound: 1,
      dropped: false,
      seat: { table: 1, team: "B", position: 1 },
    });
    expect(JSON.stringify(state)).not.toContain("p3");
  });

  it("has no seat for a player outside the round", () => {
    const late = { ...me("p9"), joinedRound: 2 };
    const state = buildEventState({ now: NOW, event, round: stored(), me: late });
    expect(state.me?.seat).toBeNull();
    expect(state.me?.joinedRound).toBe(2);
  });

  it("reports overtime once a running round's time is up", () => {
    const round = stored({ status: "running", startedAt: NOW - 3000_000 });
    expect(buildEventState({ now: NOW, event, round, me: null }).round?.status).toBe("overtime");
  });
});

describe("mySeatView", () => {
  it("gives the teammate and opponents at a 2v2 table", () => {
    const view = mySeatView(buildEventState({ now: NOW, event, round: stored(), me: me("p2") }));
    expect(view?.table.number).toBe(1);
    expect(view?.teammate?.name).toBe("Ana");
    expect(view?.opponents.map((s) => s.name)).toEqual(["Caio", "Dora"]);
  });

  it("has no teammate at the 1v1 or the bye", () => {
    const oneVsOne = mySeatView(
      buildEventState({ now: NOW, event, round: stored(), me: me("p5") })
    );
    expect(oneVsOne?.teammate).toBeNull();
    expect(oneVsOne?.opponents.map((s) => s.name)).toEqual(["Fábio"]);
    const bye = mySeatView(buildEventState({ now: NOW, event, round: stored(), me: me("p7") }));
    expect(bye?.table.kind).toBe("bye");
    expect(bye?.opponents).toEqual([]);
  });

  it("is null without a seat", () => {
    expect(mySeatView(buildEventState({ now: NOW, event, round: null, me: me("p1") }))).toBeNull();
  });
});
