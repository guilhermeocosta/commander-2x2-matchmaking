"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { EventState } from "@/core/event-state";
import { bestOffset, type ClockSample } from "@/core/timer";

export const POLL_MS = 5000;
/** Clock samples kept for the offset estimate. */
const SAMPLES = 6;

export interface LiveEventState {
  /** The last good snapshot (kept on network errors), or null before the first one. */
  state: EventState | null;
  /** `serverNow - Date.now()`: add it to the client clock to get the server's. */
  offsetMs: number;
  /** True when the last poll failed. */
  offline: boolean;
  /** Refetch now, e.g. right after a mutation. */
  refresh: () => Promise<void>;
}

/**
 * Polls `GET /api/e/[code]/state` every 5 s while the page is visible, refetches on focus and
 * when `refresh()` is called, and keeps the last good snapshot when a poll fails.
 */
export function useEventState(code: string, initial: EventState | null = null): LiveEventState {
  const [state, setState] = useState<EventState | null>(initial);
  const [offline, setOffline] = useState(false);
  const [offsetMs, setOffsetMs] = useState(0);
  const samples = useRef<ClockSample[]>([]);
  // Only the newest request may update the state, so a slow response can't undo a newer one.
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++seq.current;
    const sentAt = Date.now();
    try {
      const res = await fetch(`/api/e/${encodeURIComponent(code)}/state`, { cache: "no-store" });
      const receivedAt = Date.now();
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as EventState;
      if (typeof next?.now !== "number") throw new Error("bad snapshot");
      samples.current = [...samples.current, { sentAt, receivedAt, serverNow: next.now }].slice(
        -SAMPLES
      );
      if (id !== seq.current) return;
      setOffsetMs(bestOffset(samples.current));
      setState(next);
      setOffline(false);
    } catch {
      if (id === seq.current) setOffline(true);
    }
  }, [code]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      clearInterval(timer);
      void refresh();
      timer = setInterval(() => void refresh(), POLL_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else clearInterval(timer);
    };
    if (document.visibilityState === "visible") start();
    window.addEventListener("focus", start);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", start);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  return { state, offsetMs, offline, refresh };
}

// ---------------------------------------------------------------------------------------------
// A shared ticking clock, so every timer on the page re-renders together.

const TICK_MS = 250;
/** The client clock at the last tick; null until something subscribes. */
let clientNow: number | null = null;
const listeners = new Set<() => void>();
let ticker: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!ticker) {
    clientNow = Date.now();
    ticker = setInterval(() => {
      clientNow = Date.now();
      for (const l of listeners) l();
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(ticker);
      ticker = undefined;
    }
  };
}

/**
 * The server's clock (epoch ms), re-rendering 4 times a second. While server rendering and
 * hydrating it is `fallback` (the snapshot's own `now`).
 */
export function useServerNow(offsetMs: number, fallback: number): number {
  const now = useSyncExternalStore(
    subscribe,
    () => clientNow,
    () => null
  );
  return now === null ? fallback : now + offsetMs;
}
