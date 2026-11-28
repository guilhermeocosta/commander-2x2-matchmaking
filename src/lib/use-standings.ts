"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { EventStandings } from "@/core/event-standings";

/**
 * The event standings from `GET /api/e/[code]/standings`. Standings only change when a round
 * closes (or the admin fixes a closed round), so instead of riding on every 5 s poll they are
 * fetched when `key` changes (pass something that changes when a round closes), on focus, and
 * every `intervalMs` while given (the display between rounds). Keeps the last good copy.
 */
export function useStandings(
  code: string,
  key: string,
  initial: EventStandings | null,
  intervalMs?: number
): EventStandings | null {
  const [standings, setStandings] = useState(initial);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const id = ++seq.current;
    try {
      const res = await fetch(`/api/e/${encodeURIComponent(code)}/standings`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const body = (await res.json()) as { standings?: EventStandings | null };
      if (id === seq.current && body.standings !== undefined) setStandings(body.standings);
    } catch {
      // Keep the last good standings.
    }
  }, [code]);

  // The first render already has the server's copy; refetch only when the key moves on.
  const firstKey = useRef(key);
  useEffect(() => {
    if (key !== firstKey.current) void load();
  }, [key, load]);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const timer = intervalMs ? setInterval(() => void load(), intervalMs) : undefined;
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, [load, intervalMs]);

  return standings;
}
