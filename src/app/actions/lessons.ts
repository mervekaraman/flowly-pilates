"use server";

import { and, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { bookings, lessonLevel, lessons } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/dal";
import { addDays, atStudioTime, dayKey, formatDayLong, formatTime, isDayKey, isSunday, lessonLevelLabels, todayKey } from "@/lib/format";
import { fieldErrors, keepValues, type FormState } from "@/lib/forms";
import { fillFixedSlots } from "@/lib/fixed-slots";
import { notifyFixedFill, notifyLessonCancelled, notifyLessonChanged, notifySeatOpened } from "@/lib/notify";
import { isUuid } from "@/lib/queries";
import { lessonStartTimes } from "@/lib/studio";

const lessonSchema = z.object({
  day: z.string().refine(isDayKey, { error: "Bir gün seç." }).refine((day) => !isSunday(day), { error: "Pazar günleri ders açılmıyor." }),
  time: z.string({ error: "Başlangıç saatini seç." }).refine((time) => lessonStartTimes.includes(time), { error: "Dersler saat başında başlar; listeden bir saat seç." }),
  durationMin: z.coerce.number().int().min(30, { error: "Süre en az 30 dakika olmalı." }).max(120, { error: "Süre en fazla 120 dakika olabilir." }),
  capacity: z.coerce.number().int().min(1, { error: "Kontenjan en az 1 olmalı." }).max(12, { error: "Kontenjan en fazla 12 olabilir." }),
  level: z.enum(lessonLevel.enumValues, { error: "Seviye seç." }),
  note: z.string().trim().max(300, { error: "Not en fazla 300 karakter olabilir." }).optional().transform((value) => value || null),
  repeatWeeks: z.coerce.number().int().min(1).max(8).default(1),
});

export async function createLesson(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ role: "trainer" });
  const values = keepValues(formData, ["day", "time", "durationMin", "capacity", "level", "note"]);
  const parsed = lessonSchema.safeParse({ ...Object.fromEntries(formData), repeatWeeks: formData.get("repeat") === "on" ? formData.get("repeatWeeks") : 1 });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const data = parsed.data;
  if (data.day > addDays(todayKey(), 60)) return { fieldErrors: { day: "En fazla 60 gün sonrasına ders açabilirsin." }, values };

  const occurrences = Array.from({ length: data.repeatWeeks }, (_, week) => {
    const startsAt = atStudioTime(addDays(data.day, week * 7), data.time);
    return { startsAt, endsAt: new Date(startsAt.getTime() + data.durationMin * 60_000) };
  });
  if (occurrences[0].startsAt.getTime() <= Date.now()) return { fieldErrors: { time: "Geçmiş bir saate ders açılamaz." }, values };

  const db = await getDb();
  // One studio room: no two classes may overlap, whoever teaches them. This check only produces a
  // friendly message; the `lessons_no_overlap` constraint is what guarantees it under concurrent saves.
  for (const { startsAt, endsAt } of occurrences) {
    const [clash] = await db.select({ startsAt: lessons.startsAt }).from(lessons)
      .where(and(eq(lessons.status, "published"), lt(lessons.startsAt, endsAt), gt(lessons.endsAt, startsAt))).limit(1);
    if (clash) {
      refresh();
      return { error: `${formatDayLong(startsAt)} ${formatTime(startsAt)} için stüdyoda ${formatTime(clash.startsAt)} başlangıçlı başka bir ders var. Farklı bir saat seç.`, values };
    }
  }

  let created: { id: string }[];
  try {
    // A single statement: either every week is created or none is.
    created = await db.insert(lessons).values(occurrences.map(({ startsAt, endsAt }) => ({ trainerId: user.id, type: "reformer" as const, level: data.level, startsAt, endsAt, durationMin: data.durationMin, capacity: data.capacity, note: data.note })))
      .returning({ id: lessons.id });
  } catch (error) {
    if (!isOverlapError(error)) throw error;
    refresh();
    return { error: "Bu saat az önce başka bir derse verildi. Saat listesi güncellendi; farklı bir saat seç.", values };
  }
  // Members with a fixed weekly time at this hour get their seats before anyone else can book.
  const fixed = await fillFixedSlots({ lessonIds: created.map((row) => row.id) });
  after(() => notifyFixedFill(fixed));
  redirect(`/egitmen-paneli/takvim?gun=${data.day}&yeni=${occurrences.length}`);
}

function isOverlapError(error: unknown) {
  const code = (error as { code?: string; cause?: { code?: string } } | null);
  return code?.code === "23P01" || code?.cause?.code === "23P01";
}

export async function cancelLesson(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ role: "trainer" });
  const lessonId = String(formData.get("lessonId") ?? "");
  if (!isUuid(lessonId)) return { error: "Ders bulunamadı." };

  const db = await getDb();
  const result = await db.transaction(async (tx) => {
    const [lesson] = await tx.select({ startsAt: lessons.startsAt, status: lessons.status }).from(lessons).where(and(eq(lessons.id, lessonId), eq(lessons.trainerId, user.id))).for("update");
    if (!lesson) return { error: "Ders bulunamadı." } as const;
    if (lesson.status !== "published") return { error: "Bu ders zaten iptal edilmiş." } as const;
    if (lesson.startsAt.getTime() <= Date.now()) return { error: "Başlamış bir ders iptal edilemez." } as const;
    await tx.update(lessons).set({ status: "cancelled" }).where(eq(lessons.id, lessonId));
    // A cancelled booking keeps no note: it may hold health data (KVKK), like every other cancel path.
    const affected = await tx.update(bookings).set({ status: "cancelled", memberNote: null, memberNoteConsentAt: null, updatedAt: new Date() })
      .where(and(eq(bookings.lessonId, lessonId), inArray(bookings.status, ["pending", "approved"]))).returning({ id: bookings.id });
    return { startsAt: lesson.startsAt, bookingIds: affected.map((row) => row.id) } as const;
  });
  if ("error" in result) return { error: result.error };

  await audit(user.id, "lesson.cancel", { type: "lesson", id: lessonId }, `${result.bookingIds.length} rezervasyon iptal edildi`);
  after(() => notifyLessonCancelled(lessonId, result.bookingIds));
  redirect(`/egitmen-paneli/takvim?gun=${dayKey(result.startsAt)}&iptal=${result.bookingIds.length}`);
}

const editSchema = lessonSchema.pick({ durationMin: true, capacity: true, level: true, note: true }).extend({ lessonId: z.uuid() });

class EditError extends Error {
  constructor(message: string, readonly field?: string) { super(message); }
}

/** Trainer changes capacity, level, duration or note of an upcoming class (day and time stay). */
export async function updateLesson(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ role: "trainer" });
  const values = keepValues(formData, ["durationMin", "capacity", "level", "note"]);
  const parsed = editSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const data = parsed.data;

  const db = await getDb();
  let result: { changes: string[]; moreSeats: boolean };
  try {
    result = await db.transaction(async (tx) => {
      // Lock the class: a booking arriving meanwhile waits, so capacity can never drop below the seats taken.
      const [lesson] = await tx.select().from(lessons).where(and(eq(lessons.id, data.lessonId), eq(lessons.trainerId, user.id))).for("update");
      if (!lesson) throw new EditError("Ders bulunamadı.");
      if (lesson.status !== "published") throw new EditError("İptal edilmiş bir ders düzenlenemez.");
      if (lesson.startsAt.getTime() <= Date.now()) throw new EditError("Başlamış bir ders düzenlenemez.");

      const [{ taken }] = await tx.select({ taken: sql<number>`count(*)::int` }).from(bookings).where(and(eq(bookings.lessonId, lesson.id), inArray(bookings.status, ["pending", "approved"])));
      if (data.capacity < taken) throw new EditError(`Bu derste ${taken} kişi kayıtlı; kontenjan en az ${taken} olmalı.`, "capacity");

      const endsAt = new Date(lesson.startsAt.getTime() + data.durationMin * 60_000);
      if (data.durationMin !== lesson.durationMin) {
        const [clash] = await tx.select({ startsAt: lessons.startsAt }).from(lessons)
          .where(and(eq(lessons.status, "published"), ne(lessons.id, lesson.id), lt(lessons.startsAt, endsAt), gt(lessons.endsAt, lesson.startsAt))).limit(1);
        if (clash) throw new EditError(`Süre uzayınca ${formatTime(clash.startsAt)} dersiyle çakışıyor. Daha kısa bir süre seç.`, "durationMin");
      }

      await tx.update(lessons).set({ durationMin: data.durationMin, endsAt, capacity: data.capacity, level: data.level, note: data.note }).where(eq(lessons.id, lesson.id));
      const changes = [
        ...(data.level !== lesson.level ? [`seviye: ${lessonLevelLabels[data.level]}`] : []),
        ...(data.durationMin !== lesson.durationMin ? [`süre: ${data.durationMin} dk`] : []),
      ];
      return { changes, moreSeats: data.capacity > lesson.capacity };
    });
  } catch (error) {
    if (error instanceof EditError) return error.field ? { fieldErrors: { [error.field]: error.message }, values } : { error: error.message, values };
    if (isOverlapError(error)) return { fieldErrors: { durationMin: "Bu süreyle stüdyodaki başka bir dersle çakışıyor." }, values };
    throw error;
  }

  await audit(user.id, "lesson.update", { type: "lesson", id: data.lessonId }, `süre ${data.durationMin} dk · kontenjan ${data.capacity} · seviye ${data.level}`);
  after(async () => {
    await notifyLessonChanged(data.lessonId, result.changes);
    if (result.moreSeats) await notifySeatOpened(data.lessonId);
  });
  redirect(`/egitmen-paneli/dersler/${data.lessonId}?duzenlendi=1`);
}
