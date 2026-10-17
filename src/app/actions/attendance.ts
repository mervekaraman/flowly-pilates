"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { attendanceStatus, bookings, lessons, reviews } from "@/db/schema";
import { requireUser } from "@/lib/dal";
import type { FormState } from "@/lib/forms";
import { isUuid } from "@/lib/queries";

const ended = (lesson: { startsAt: Date; durationMin: number }) => lesson.startsAt.getTime() + lesson.durationMin * 60_000 <= Date.now();

/** Member rates how hard a class they attended felt (RPE 1–10). Can be changed later. */
export async function rateEffort(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ role: "member" });
  const parsed = z.object({
    bookingId: z.string().refine(isUuid),
    effort: z.coerce.number({ error: "Bir puan seç." }).int().min(1, { error: "Bir puan seç." }).max(10, { error: "Puan 1 ile 10 arasında olmalı." }),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Bir puan seç." };

  const db = await getDb();
  const [booking] = await db.select({ status: bookings.status, attendance: bookings.attendance, startsAt: lessons.startsAt, durationMin: lessons.durationMin, lessonStatus: lessons.status })
    .from(bookings).innerJoin(lessons, eq(lessons.id, bookings.lessonId))
    .where(and(eq(bookings.id, parsed.data.bookingId), eq(bookings.memberId, user.id))).limit(1);
  // Only members who actually took the class: approved and marked present by the trainer.
  if (!booking || booking.status !== "approved" || booking.lessonStatus !== "published") return { error: "Efor puanını yalnızca katıldığın derslere verebilirsin." };
  if (booking.attendance !== "attended") return { error: booking.attendance === "no_show" ? "Eğitmenin bu derse katılmadığını işaretledi." : "Efor puanı, eğitmenin katılımını işaretlemesinden sonra açılır." };
  if (!ended(booking)) return { error: "Efor puanı ders bittikten sonra açılır." };

  await db.update(bookings).set({ effort: parsed.data.effort, effortAt: new Date() }).where(eq(bookings.id, parsed.data.bookingId));
  refresh();
  return { ok: true, message: "Efor puanın kaydedildi." };
}

/** Trainer marks who came; only members marked present can rate effort and review the class. */
export async function markAttendance(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ role: "trainer" });
  const parsed = z.object({ bookingId: z.string().refine(isUuid), value: z.enum(attendanceStatus.enumValues) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Geçersiz işlem." };

  const db = await getDb();
  const [booking] = await db.select({ status: bookings.status, startsAt: lessons.startsAt })
    .from(bookings).innerJoin(lessons, eq(lessons.id, bookings.lessonId))
    .where(and(eq(bookings.id, parsed.data.bookingId), eq(lessons.trainerId, user.id))).limit(1);
  if (!booking || booking.status !== "approved") return { error: "Bu rezervasyon bulunamadı." };
  if (booking.startsAt.getTime() > Date.now()) return { error: "Katılım ders başladıktan sonra işaretlenir." };

  await db.update(bookings).set({
    attendance: parsed.data.value,
    attendanceMarkedAt: new Date(),
    // A member marked absent has no effort to report.
    ...(parsed.data.value === "no_show" ? { effort: null, effortAt: null } : {}),
    updatedAt: new Date(),
  }).where(eq(bookings.id, parsed.data.bookingId));
  // Public reviews are only for classes the member attended; a correction takes the review down.
  if (parsed.data.value !== "attended") await db.delete(reviews).where(eq(reviews.bookingId, parsed.data.bookingId));
  refresh();
  return { ok: true };
}
