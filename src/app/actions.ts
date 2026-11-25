"use server";

import { redirect } from "next/navigation";

import { eventCodeSchema, getEventByCode } from "@/db/queries";

export interface CodeFormState {
  error?: string;
}

/** Home page: goes to `/e/CODE` when the event exists. */
export async function goToEventAction(
  _prev: CodeFormState,
  formData: FormData
): Promise<CodeFormState> {
  const parsed = eventCodeSchema.safeParse(formData.get("code"));
  if (!parsed.success) return { error: "O código tem 4 letras ou números." };
  let found: boolean;
  try {
    found = (await getEventByCode(parsed.data)) !== undefined;
  } catch {
    return { error: "Não foi possível buscar o evento. Tente de novo." };
  }
  if (!found) return { error: "Evento não encontrado. Confira o código." };
  redirect(`/e/${parsed.data}`);
}
