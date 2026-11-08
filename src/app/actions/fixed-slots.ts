"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { fixedSlots } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/dal";
import { MAX_FIXED_SLOTS, isFixedSlotTime, isFixedSlotWeekday, slotLabel } from "@/lib/fixed-slot-rules";
import { endFixedSlot, fillFixedSlots } from "@/lib/fixed-slots";
import { fieldErrors, type FormState } from "@/lib/forms";
import { notifyFixedFill, notifyFixedSlotDecision, notifyFixedSlotEnded, notifyFixedSlotRequested, notifySeatOpened } from "@/lib/notify";
import { hitRateLimit } from "@/lib/rate-limit";

const slotSchema = z.object({
  weekday: z.coerce.number({ error: "Bir gün seç." }).int().refine(isFixedSlotWeekday, { error: "Pazartesi ile cumartesi arasında bir gün seç." }),
  startTime: z.string({ error: "Bir saat seç." }).refine(isFixedSlotTime, { error: "Dersler saat başında başlar; listeden bir saat seç." }),
});

const isUniqueViolation = (error: unknown) => {
  const code = error as { code?: string; cause?: { code?: string } } | null;
  return code?.code === "23505" || code?.cause?.code === "23505";
};

/** Member asks for a standing weekly time; a trainer approves it once. */
export async function requestFixedSlot(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ role: "member", next: "/sabit-saatler" });
  const parsed = slotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  // Each request notifies every trainer.
  if (await hitRateLimit(`fixed-slot:${user.id}`, 10, 24 * 60 * 60 * 1000)) return { error: "Bugün çok fazla sabit saat talebi gönderdin. Yarın tekrar dene." };

  const db = await getDb();
  const [{ open }] = await db.select({ open: sql<number>`count(*)::int` }).from(fixedSlots)
    .where(and(eq(fixedSlots.memberId, user.id), inArray(fixedSlots.status, ["pending", "active"])));
  if (open >= MAX_FIXED_SLOTS) return { error: `En fazla ${MAX_FIXED_SLOTS} sabit saatin olabilir. Yenisini eklemek için birini kaldır.` };

  let slotId: string;
  try {
    const [created] = await db.insert(fixedSlots).values({ memberId: user.id, weekday: parsed.data.weekday, startTime: parsed.data.startTime }).returning({ id: fixedSlots.id });
    slotId = created.id;
  } catch (error) {
    if (isUniqueViolation(error)) return { error: `${slotLabel(parsed.data)} için zaten bir sabit saatin ya da bekleyen talebin var.` };
    throw error;
  }
  after(() => notifyFixedSlotRequested(slotId));
  refresh();
  return { ok: true, message: `${slotLabel(parsed.data)} talebin eğitmene iletildi. Onaylanınca o saatteki derslere her hafta otomatik eklenirsin.` };
}

/** Trainer approves (and books the member into upcoming classes at once) or rejects a request. */
export async function decideFixedSlot(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ role: "trainer" });
  const parsed = z.object({ slotId: z.uuid(), decision: z.enum(["approve", "reject"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Talep bulunamadı." };

  const db = await getDb();
  const decided = await db.update(fixedSlots).set({ status: parsed.data.decision === "approve" ? "active" : "rejected", decidedAt: new Date() })
    .where(and(eq(fixedSlots.id, parsed.data.slotId), eq(fixedSlots.status, "pending"))).returning({ id: fixedSlots.id });
  if (!decided.length) return { error: "Bu talep az önce değişti (üye geri çekmiş olabilir). Sayfayı yenile." };

  await audit(user.id, `fixed_slot.${parsed.data.decision}`, { type: "fixed_slot", id: parsed.data.slotId });
  const result = parsed.data.decision === "approve" ? await fillFixedSlots({ slotId: parsed.data.slotId }) : { booked: [], full: [] };
  after(async () => {
    await notifyFixedSlotDecision(parsed.data.slotId, result.booked.length);
    // Only the "class was full" alerts: the decision message above already says how many were booked.
    await notifyFixedFill({ booked: [], full: result.full });
  });
  // The request card disappears once decided, so the outcome travels in the URL to a page notice.
  redirect(parsed.data.decision === "reject" ? "/egitmen-paneli/sabit-saatler?karar=ret"
    : `/egitmen-paneli/sabit-saatler?karar=onay&eklendi=${result.booked.length}&dolu=${result.full.length}`);
}

/** Member withdraws their own fixed time, or a trainer ends any member's. */
export async function stopFixedSlot(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const slotId = z.uuid().safeParse(formData.get("slotId"));
  if (!slotId.success) return { error: "Sabit saat bulunamadı." };

  const result = await endFixedSlot(slotId.data, user.role === "trainer" ? {} : { memberId: user.id });
  if (!result) return { error: "Bu sabit saat zaten sona ermiş." };
  if (user.role === "trainer") await audit(user.id, "fixed_slot.stop", { type: "fixed_slot", id: slotId.data }, `${result.freed.length} rezervasyon iptal edildi`);
  after(async () => {
    await notifyFixedSlotEnded(slotId.data, user.role === "trainer" ? "trainer" : "member");
    for (const lessonId of new Set(result.freed.map((row) => row.lessonId))) await notifySeatOpened(lessonId);
  });
  // The row disappears once ended, so the outcome travels in the URL to a page notice.
  redirect(`${user.role === "trainer" ? "/egitmen-paneli/sabit-saatler" : "/sabit-saatler"}?kaldirildi=1&iptal=${result.freed.length}&kalan=${result.kept}`);
}
