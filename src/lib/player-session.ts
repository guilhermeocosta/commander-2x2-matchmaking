import "server-only";

import { cookies } from "next/headers";

import { getEventPlayerByTokenHash } from "@/db/queries";
import type { EventPlayerRow, EventRow } from "@/db/schema";

import { deviceCookieName, hashDeviceToken, isDeviceToken } from "./device-token";

/** Long enough for the event day and a late look at the standings. */
const COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60;

/** The player this device joined `event` as, from its device-token cookie. */
export async function getCurrentPlayer(event: EventRow): Promise<EventPlayerRow | undefined> {
  const store = await cookies();
  const token = store.get(deviceCookieName(event.code))?.value;
  if (!isDeviceToken(token)) return undefined;
  return getEventPlayerByTokenHash(event.id, hashDeviceToken(token));
}

/** Stores the device token in this browser. Server Actions only. */
export async function setDeviceCookie(eventCode: string, token: string): Promise<void> {
  const store = await cookies();
  store.set(deviceCookieName(eventCode), token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SEC,
  });
}
