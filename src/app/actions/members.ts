"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/dal";
import { fieldErrors, keepValues, type FormState } from "@/lib/forms";
import { createPlaceholderMember, mergePlaceholder } from "@/lib/members";
import { isUuid } from "@/lib/queries";

/** Trainer adds a studio member who is not in the app yet (name only), so their seats can be booked. */
export async function addPlaceholderMember(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ role: "trainer" });
  const parsed = z.object({
    name: z.string().trim().min(3, { error: "Ad ve soyadı yaz." }).max(80, { error: "Ad en fazla 80 karakter olabilir." })
      .refine((name) => name.includes(" "), { error: "Ad ve soyadı birlikte yaz." }),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: keepValues(formData, ["name"]) };

  const created = await createPlaceholderMember(parsed.data.name);
  await audit(user.id, "member.placeholder_add", { type: "user", id: created.id });
  refresh();
  return { ok: true, message: `${created.name} eklendi. Derslere ekleyebilir, paket ve sabit saat tanımlayabilirsin.` };
}

/** Trainer moves a placeholder's classes, package and fixed times to the member's real account. */
export async function mergeMember(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ role: "trainer" });
  const parsed = z.object({ placeholderId: z.string().refine(isUuid), memberId: z.string({ error: "Gerçek üye hesabını seç." }).refine(isUuid, { error: "Gerçek üye hesabını seç." }) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Gerçek üye hesabını seç." };

  const result = await mergePlaceholder(parsed.data.placeholderId, parsed.data.memberId);
  if ("error" in result) return { error: result.error };
  await audit(user.id, "member.merge", { type: "user", id: parsed.data.memberId }, `hesapsız üye ${parsed.data.placeholderId} birleştirildi · ${result.bookings} rezervasyon, ${result.packages} paket, ${result.fixedSlots} sabit saat`);
  // The placeholder's card disappears, so the outcome travels in the URL to a notice at the top.
  redirect(`/egitmen-paneli/uyeler?birlesti=1&rez=${result.bookings}&paket=${result.packages}&sabit=${result.fixedSlots}`);
}
