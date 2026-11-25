"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { dropAfterRound } from "@/core/players";
import { rosterIdSchema } from "@/core/roster";
import {
  getEventByCode,
  getLatestRoundNumber,
  swapDeviceTokenHash,
  updateEventPlayer,
} from "@/db/queries";
import { hashDeviceToken, isDeviceToken, newDeviceToken } from "@/lib/device-token";
import { getCurrentPlayer, setDeviceCookie } from "@/lib/player-session";
import { addPlayer, audit, findRosterEntry, GENERIC_ERROR, ROSTER_UNKNOWN } from "@/lib/players";
import { getRoster } from "@/lib/roster";

/** State shown by the player forms; `error` is pt-BR copy and never includes internals. */
export interface PlayerFormState {
  error?: string;
}

const EVENT_NOT_FOUND = "Evento não encontrado.";

const joinSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("roster"), rosterId: rosterIdSchema }),
  z.object({
    mode: z.literal("name"),
    name: z
      .string("Digite seu nome.")
      .trim()
      .min(1, "Digite seu nome.")
      .max(60, "O nome pode ter até 60 caracteres."),
  }),
]);

export async function joinAction(
  code: string,
  _prev: PlayerFormState,
  formData: FormData
): Promise<PlayerFormState> {
  const event = await getEventByCode(code);
  if (!event) return { error: EVENT_NOT_FOUND };

  // A device that already joined goes back to its own player instead of adding another.
  if (await getCurrentPlayer(event)) redirect(`/e/${event.code}`);

  const parsed = joinSchema.safeParse({
    mode: formData.get("mode"),
    rosterId: formData.get("rosterId") ?? undefined,
    name: formData.get("name") ?? undefined,
  });
  if (!parsed.success) {
    // Only the name has messages meant for people; anything else is a bad or stale form.
    const nameIssue = parsed.error.issues.find((issue) => issue.path[0] === "name");
    return { error: nameIssue?.message ?? "Escolha seu nome na lista ou digite um nome." };
  }

  let displayName: string;
  let rosterId: string | null = null;
  if (parsed.data.mode === "roster") {
    // The roster is untrusted and may be unavailable: only accept ids it lists right now.
    const entry = findRosterEntry(await getRoster(), parsed.data.rosterId);
    if (!entry) return { error: ROSTER_UNKNOWN };
    displayName = entry.name;
    rosterId = entry.id;
  } else {
    displayName = parsed.data.name;
  }

  const token = newDeviceToken();
  const result = await addPlayer(event, {
    displayName,
    rosterId,
    deviceTokenHash: hashDeviceToken(token),
  });
  if (!result.ok) return { error: result.error };

  await setDeviceCookie(event.code, token);
  await audit({
    eventId: event.id,
    actor: `player:${result.value.id}`,
    action: "player_joined",
    payload: {
      playerId: result.value.id,
      rosterId,
      joinedRound: result.value.joinedRound,
    },
  });
  redirect(`/e/${event.code}`);
}

// useActionState also passes the previous state and the form data; neither is needed here.
export async function dropSelfAction(code: string): Promise<PlayerFormState> {
  const event = await getEventByCode(code);
  if (!event) return { error: EVENT_NOT_FOUND };
  // Players may only act on their own seat: the cookie decides who, never the form.
  const player = await getCurrentPlayer(event);
  if (!player) return { error: "Este aparelho não está inscrito no evento." };
  if (player.droppedAfterRound !== null) return {};

  try {
    const afterRound = dropAfterRound(await getLatestRoundNumber(event.id));
    await updateEventPlayer(event.id, player.id, { droppedAfterRound: afterRound });
    await audit({
      eventId: event.id,
      actor: `player:${player.id}`,
      action: "player_dropped",
      payload: { playerId: player.id, droppedAfterRound: afterRound },
    });
  } catch {
    return { error: GENERIC_ERROR };
  }
  refresh();
  return {};
}

const claimSchema = z.object({ token: z.string().refine(isDeviceToken) });

/**
 * Claims a reissued link on this device. The link's token works once: it is swapped for a fresh
 * token that only this browser's cookie holds.
 */
export async function claimLinkAction(
  code: string,
  _prev: PlayerFormState,
  formData: FormData
): Promise<PlayerFormState> {
  const event = await getEventByCode(code);
  if (!event) return { error: EVENT_NOT_FOUND };
  const parsed = claimSchema.safeParse({ token: formData.get("token") });
  const invalid = { error: "Link inválido ou já usado. Peça um novo à organização." };
  if (!parsed.success) return invalid;

  const token = newDeviceToken();
  let playerId: string;
  try {
    const player = await swapDeviceTokenHash(
      event.id,
      hashDeviceToken(parsed.data.token),
      hashDeviceToken(token)
    );
    if (!player) return invalid;
    playerId = player.id;
  } catch {
    return { error: GENERIC_ERROR };
  }

  await setDeviceCookie(event.code, token);
  await audit({
    eventId: event.id,
    actor: `player:${playerId}`,
    action: "player_link_claimed",
    payload: { playerId },
  });
  redirect(`/e/${event.code}`);
}
