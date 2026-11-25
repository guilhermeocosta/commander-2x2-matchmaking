"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { dropAfterRound } from "@/core/players";
import { rosterIdSchema } from "@/core/roster";
import {
  getEventByCode,
  getEventPlayer,
  getLatestPairedRoundNumber,
  isUniqueViolation,
  updateEventPlayer,
} from "@/db/queries";
import type { EventPlayerRow, EventRow } from "@/db/schema";
import { isAdmin, LOGIN_PATH } from "@/lib/auth";
import { hashDeviceToken, newDeviceToken } from "@/lib/device-token";
import { qrSvg, requestOrigin } from "@/lib/links";
import {
  addPlayer,
  audit,
  findRosterEntry,
  GENERIC_ERROR,
  ROSTER_TAKEN,
  ROSTER_UNKNOWN,
} from "@/lib/players";
import { getRoster } from "@/lib/roster";

/** State shown by the admin player forms; `error` and `ok` are pt-BR copy. */
export interface PlayerAdminState {
  error?: string;
  ok?: string;
  /** A freshly reissued link for one player, with its QR code (SVG markup). */
  link?: { url: string; qr: string };
}

const EVENT_NOT_FOUND = "Evento não encontrado.";
const PLAYER_NOT_FOUND = "Jogador não encontrado neste evento.";

/** Every admin action starts here: the session is checked on the server, then the event. */
async function adminEvent(code: string): Promise<EventRow | undefined> {
  if (!(await isAdmin())) redirect(LOGIN_PATH);
  return getEventByCode(code);
}

const nameSchema = z
  .string("Digite um nome.")
  .trim()
  .min(1, "Digite um nome.")
  .max(60, "O nome pode ter até 60 caracteres.");

/** A `<select>` value: "" means no roster link. */
const rosterChoiceSchema = z
  .union([z.literal(""), rosterIdSchema], "Escolha um nome da lista.")
  .transform((v) => (v === "" ? null : v));

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Confira os campos.";
}

const addSchema = z.object({ name: z.string().trim().max(60), rosterId: rosterChoiceSchema });

export async function addPlayerAction(
  code: string,
  _prev: PlayerAdminState,
  formData: FormData
): Promise<PlayerAdminState> {
  const event = await adminEvent(code);
  if (!event) return { error: EVENT_NOT_FOUND };
  const parsed = addSchema.safeParse({
    name: formData.get("name") ?? "",
    rosterId: formData.get("rosterId") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  let displayName = parsed.data.name;
  const { rosterId } = parsed.data;
  if (rosterId) {
    const entry = findRosterEntry(await getRoster(), rosterId);
    if (!entry) return { error: ROSTER_UNKNOWN };
    // An empty name means "use the roster name".
    displayName ||= entry.name;
  }
  if (!displayName) return { error: "Digite um nome ou escolha um da lista." };

  // Added by hand: no device yet. "Gerar link" hands the player a link for their phone.
  const result = await addPlayer(event, { displayName, rosterId, deviceTokenHash: null });
  if (!result.ok) return { error: result.error };

  await audit({
    eventId: event.id,
    actor: "admin",
    action: "player_added",
    payload: { playerId: result.value.id, rosterId, joinedRound: result.value.joinedRound },
  });
  refresh();
  return { ok: "Jogador adicionado." };
}

const updateSchema = z.object({
  playerId: z.uuid(),
  name: nameSchema,
  rosterId: rosterChoiceSchema,
});

/** Rename and/or change the roster link. */
export async function updatePlayerAction(
  code: string,
  _prev: PlayerAdminState,
  formData: FormData
): Promise<PlayerAdminState> {
  const event = await adminEvent(code);
  if (!event) return { error: EVENT_NOT_FOUND };
  const parsed = updateSchema.safeParse({
    playerId: formData.get("playerId"),
    name: formData.get("name"),
    rosterId: formData.get("rosterId") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { playerId, name, rosterId } = parsed.data;

  let before: EventPlayerRow | undefined;
  try {
    before = await getEventPlayer(event.id, playerId);
  } catch {
    return { error: GENERIC_ERROR };
  }
  if (!before) return { error: PLAYER_NOT_FOUND };
  const renamed = name !== before.displayName;
  const relinked = rosterId !== before.rosterId;
  if (!renamed && !relinked) return { ok: "Nada mudou." };
  if (relinked && rosterId && !findRosterEntry(await getRoster(), rosterId)) {
    return { error: ROSTER_UNKNOWN };
  }

  try {
    await updateEventPlayer(event.id, playerId, { displayName: name, rosterId });
  } catch (error) {
    if (isUniqueViolation(error)) return { error: ROSTER_TAKEN };
    return { error: GENERIC_ERROR };
  }
  if (renamed) {
    await audit({
      eventId: event.id,
      actor: "admin",
      action: "player_renamed",
      payload: { playerId },
    });
  }
  if (relinked) {
    await audit({
      eventId: event.id,
      actor: "admin",
      action: rosterId ? "player_roster_linked" : "player_roster_unlinked",
      payload: { playerId, rosterId, previousRosterId: before.rosterId },
    });
  }
  refresh();
  return { ok: "Alterações salvas." };
}

const dropSchema = z.object({ playerId: z.uuid(), dropped: z.enum(["true", "false"]) });

/** Drop (`dropped=true`) or undo a drop (`dropped=false`). */
export async function setDroppedAction(
  code: string,
  _prev: PlayerAdminState,
  formData: FormData
): Promise<PlayerAdminState> {
  const event = await adminEvent(code);
  if (!event) return { error: EVENT_NOT_FOUND };
  const parsed = dropSchema.safeParse({
    playerId: formData.get("playerId"),
    dropped: formData.get("dropped"),
  });
  if (!parsed.success) return { error: GENERIC_ERROR };
  const { playerId } = parsed.data;
  const dropped = parsed.data.dropped === "true";

  try {
    const afterRound = dropped ? dropAfterRound(await getLatestPairedRoundNumber(event.id)) : null;
    const row = await updateEventPlayer(event.id, playerId, { droppedAfterRound: afterRound });
    if (!row) return { error: PLAYER_NOT_FOUND };
    await audit({
      eventId: event.id,
      actor: "admin",
      action: dropped ? "player_dropped" : "player_drop_undone",
      payload: { playerId, droppedAfterRound: afterRound },
    });
  } catch {
    return { error: GENERIC_ERROR };
  }
  refresh();
  return { ok: dropped ? "Jogador marcado como desistente." : "Desistência desfeita." };
}

const reissueSchema = z.object({ playerId: z.uuid() });

/**
 * Gives a player a new link for another phone. The old device stops working at once; the link
 * works once (claiming it swaps the token again, see `claimLinkAction`).
 */
export async function reissueLinkAction(
  code: string,
  _prev: PlayerAdminState,
  formData: FormData
): Promise<PlayerAdminState> {
  const event = await adminEvent(code);
  if (!event) return { error: EVENT_NOT_FOUND };
  const parsed = reissueSchema.safeParse({ playerId: formData.get("playerId") });
  if (!parsed.success) return { error: GENERIC_ERROR };
  const { playerId } = parsed.data;

  const token = newDeviceToken();
  try {
    const row = await updateEventPlayer(event.id, playerId, {
      deviceTokenHash: hashDeviceToken(token),
    });
    if (!row) return { error: PLAYER_NOT_FOUND };
  } catch {
    return { error: GENERIC_ERROR };
  }
  // Never log or audit the token itself.
  await audit({
    eventId: event.id,
    actor: "admin",
    action: "player_link_reissued",
    payload: { playerId },
  });

  // The token goes in the fragment, which browsers don't send to the server.
  const url = `${await requestOrigin()}/e/${event.code}/entrar#${token}`;
  refresh();
  return { ok: "Link gerado.", link: { url, qr: await qrSvg(url) } };
}
