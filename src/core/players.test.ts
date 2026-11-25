import { describe, expect, it } from "vitest";

import { canStillPlay, dropAfterRound, joinRound, playerStatus } from "./players";

describe("late join", () => {
  it("joins round 1 before any round is paired", () => {
    expect(joinRound(0)).toBe(1);
  });

  it("joins the next unpaired round once rounds exist", () => {
    expect(joinRound(1)).toBe(2);
    expect(joinRound(2)).toBe(3);
  });

  it("can't play once every round is paired", () => {
    expect(canStillPlay(2, 3)).toBe(true);
    expect(canStillPlay(3, 3)).toBe(false);
  });
});

describe("drop", () => {
  it("drops after the latest paired round", () => {
    expect(dropAfterRound(0)).toBe(0);
    expect(dropAfterRound(2)).toBe(2);
  });
});

describe("playerStatus", () => {
  it("is active by default", () => {
    expect(playerStatus({ joinedRound: 1, droppedAfterRound: null }, 0)).toEqual({
      kind: "active",
    });
    expect(playerStatus({ joinedRound: 1, droppedAfterRound: null }, 2)).toEqual({
      kind: "active",
    });
  });

  it("is dropped when dropped_after_round is set, even 0", () => {
    expect(playerStatus({ joinedRound: 1, droppedAfterRound: 0 }, 0)).toEqual({
      kind: "dropped",
      afterRound: 0,
    });
  });

  it("is late until their round is paired", () => {
    expect(playerStatus({ joinedRound: 2, droppedAfterRound: null }, 1)).toEqual({
      kind: "late",
      round: 2,
    });
    expect(playerStatus({ joinedRound: 2, droppedAfterRound: null }, 2)).toEqual({
      kind: "active",
    });
  });
});
