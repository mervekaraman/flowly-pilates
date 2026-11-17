"use server";

import { and, eq, gt, inArray } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { bookings, emailOutbox, lessons, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/dal";
import { fieldErrors, keepValues, type FormState } from "@/lib/forms";
import { createPlaceholderMember, mergePlaceholder } from "@/lib/members";
import { notifyMemberApproved, sendMemberRejectedEmail } from "@/lib/notify";
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

/**
 * A member who signed up on their own: the trainer confirms they belong to the studio (they can then
 * book), or rejects them, which deletes the account entirely, as if they had deleted it themselves.
 */
export async function decideMember(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ role: "trainer" });
  const parsed = z.object({ memberId: z.uuid(), decision: z.enum(["approve", "reject"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Üye bulunamadı." };
  const { memberId, decision } = parsed.data;
  const db = await getDb();
  const waiting = and(eq(users.id, memberId), eq(users.role, "member"), eq(users.awaitingApproval, true));

  if (decision === "approve") {
    const done = await db.update(users).set({ awaitingApproval: false }).where(waiting).returning({ id: users.id });
    if (!done.length) return { error: "Bu üye için az önce karar verilmiş. Sayfayı yenile." };
    await audit(user.id, "member.approve", { type: "user", id: memberId });
    after(() => notifyMemberApproved(memberId));
    // The card leaves the waiting list, so the outcome travels in the URL to a notice at the top.
    redirect("/egitmen-paneli/uyeler?karar=onay");
  }

  const [person] = await db.select({ name: users.name, email: users.email }).from(users).where(waiting).limit(1);
  if (!person) return { error: "Bu üye için az önce karar verilmiş. Sayfayı yenile." };
  // A trainer may have put them in a class already; deleting would silently free that seat.
  const [seat] = await db.select({ id: bookings.id }).from(bookings).innerJoin(lessons, eq(lessons.id, bookings.lessonId))
    .where(and(eq(bookings.memberId, memberId), inArray(bookings.status, ["pending", "approved"]), gt(lessons.startsAt, new Date()))).limit(1);
  if (seat) return { error: "Bu üyeyi bir derse eklemişsin. Reddetmeden önce onu dersten çıkar ya da üyeliğini onayla." };
  // Cascades remove sessions, notifications, push devices and everything else stored about them.
  await db.transaction(async (tx) => {
    await tx.delete(emailOutbox).where(eq(emailOutbox.to, person.email));
    await tx.delete(users).where(waiting);
  });
  await audit(user.id, "member.reject", { type: "user", id: memberId }, "kayıt reddedildi, hesap silindi");
  after(() => sendMemberRejectedEmail(person));
  redirect("/egitmen-paneli/uyeler?karar=ret");
}
