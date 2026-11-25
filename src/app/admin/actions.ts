"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createEventWithNewCode, writeAudit } from "@/db/queries";
import type { EventRow } from "@/db/schema";
import { isAdmin, LOGIN_PATH, login, logout } from "@/lib/auth";

/** State shown by the forms; `error` is pt-BR copy and never includes internals. */
export interface FormState {
  error?: string;
  ok?: string;
}

const loginSchema = z.object({ password: z.string().min(1).max(200) });

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { error: "Digite a senha." };

  const ok = await login(parsed.data.password);
  try {
    // Never record the password, not even a wrong one.
    await writeAudit({ eventId: null, actor: "admin", action: ok ? "login" : "login_failed" });
  } catch {
    // An audit failure must not lock the organizer out (or let anyone in): carry on.
  }
  if (!ok) return { error: "Senha incorreta." };
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect(LOGIN_PATH);
}

const newEventFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Dê um nome ao evento.")
    .max(100, "O nome pode ter até 100 caracteres."),
  date: z.iso.date("Escolha uma data válida."),
});

export async function createEventAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await isAdmin())) redirect(LOGIN_PATH);

  const parsed = newEventFormSchema.safeParse({
    name: formData.get("name"),
    date: formData.get("date"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Confira os campos." };
  }

  let event: EventRow;
  try {
    // Rounds and duration stay at the schema defaults (3 rounds of 50 minutes) in Phase 0.
    event = await createEventWithNewCode(parsed.data);
  } catch {
    return { error: "Não foi possível criar o evento. Tente de novo." };
  }
  try {
    await writeAudit({
      eventId: event.id,
      actor: "admin",
      action: "event_created",
      payload: { code: event.code, name: event.name, date: event.date },
    });
  } catch {
    // The event exists; a missing audit line must not make the organizer create it twice.
  }

  refresh();
  return { ok: `Evento criado com o código ${event.code}.` };
}
