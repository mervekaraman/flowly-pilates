"use server";

import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { bookings, lessons, users, waitlist } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/dal";
import { isFixedSlotTime, isFixedSlotWeekday, slotOf } from "@/lib/fixed-slot-rules";
import { activateFixedSlot, fillFixedSlots } from "@/lib/fixed-slots";
import { fieldErrors, keepValues, type FormState } from "@/lib/forms";
import { parseSpotifyLink } from "@/lib/spotify";
import { notifyBookingCancelled, notifyBookingDecision, notifyBookingRequested, notifyFixedFill, notifyFixedSlotDecision, notifyMemberAdded, notifyMemberRemoved, notifySeatOpened } from "@/lib/notify";
import { isUuid } from "@/lib/queries";
import { hitRateLimit } from "@/lib/rate-limit";
import { studio } from "@/lib/studio";

const note = z.string().trim().max(300, { error: "Not en fazla 300 karakter olabilir." }).optional().transform((value) => value || null);
const playlist = z.string().trim().max(300).optional().transform((value, ctx) => {
  if (!value) return null;
  const link = parseSpotifyLink(value);
  if (!link) ctx.addIssue({ code: "custom", message: "Bu bir Spotify çalma listesi linki gibi görünmüyor. Spotify'da listeyi açıp Paylaş › Bağlantıyı kopyala ile al." });
  return link?.url ?? null;
});

/** A reused booking row (cancelled, rejected) starts clean: no old note, consent, playlist or result. */
const freshBooking = { memberNote: null, memberNoteConsentAt: null, playlistUrl: null, trainerNote: null, decidedAt: null, attendance: null, attendanceMarkedAt: null, effort: null, effortAt: null, reminderSentAt: null };
/** Once a booking is no longer active, the member's note (possibly health data) is withdrawn too. */
const withdrawNote = { memberNote: null, memberNoteConsentAt: null };
const MAX_PENDING = 5;

class BookingError extends Error {
  constructor(message: string, readonly code?: "full") {
    super(message);
  }
}

export async function requestBooking(_: FormState, formData: FormData): Promise<FormState> {
  const lessonId = String(formData.get("lessonId") ?? "");
  const user = await requireUser({ role: "member", next: `/dersler/${lessonId}` });
  const parsed = z.object({ lessonId: z.uuid(), memberNote: note, playlistUrl: playlist, noteConsent: z.literal("on").optional() })
    // A note may carry health data (KVKK md. 6): it is only stored with the member's explicit consent.
    .refine((data) => !data.memberNote || data.noteConsent === "on", { path: ["noteConsent"], error: "Notunu eğitmenine iletebilmemiz için açık rıza kutusunu işaretle ya da notu boş bırak." })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: keepValues(formData, ["memberNote", "playlistUrl"]) };
  const noteConsentAt = parsed.data.memberNote ? new Date() : null;
  // Every request e-mails and notifies the trainer, so requests are limited per member.
  if (await hitRateLimit(`booking-request:${user.id}`, 10, 60 * 60 * 1000) || await hitRateLimit(`booking-request-day:${user.id}`, 30, 24 * 60 * 60 * 1000)) {
    return { error: "Kısa sürede çok fazla talep gönderdin. Biraz sonra tekrar dene.", values: keepValues(formData, ["memberNote", "playlistUrl"]) };
  }

  const db = await getDb();
  let bookingId: string;
  try {
    bookingId = await db.transaction(async (tx) => {
      // Lock the lesson row so two members cannot both take the last seat.
      const [lesson] = await tx.select({ id: lessons.id, status: lessons.status, startsAt: lessons.startsAt, capacity: lessons.capacity }).from(lessons).where(eq(lessons.id, parsed.data.lessonId)).for("update");
      if (!lesson || lesson.status !== "published") throw new BookingError("Bu ders artık programda değil.");
      if (lesson.startsAt.getTime() <= Date.now()) throw new BookingError("Bu ders başladı ya da sona erdi.");

      const [existing] = await tx.select({ id: bookings.id, status: bookings.status }).from(bookings).where(and(eq(bookings.lessonId, lesson.id), eq(bookings.memberId, user.id)));
      if (existing && (existing.status === "pending" || existing.status === "approved")) throw new BookingError("Bu ders için zaten bir rezervasyonun var.");
      // The trainer's "no" stands; asking again would only hold the seat and notify them again.
      if (existing?.status === "rejected") throw new BookingError("Bu ders için talebin onaylanmadı. Programdan başka bir saat seçebilirsin.");
      // Waiting requests hold seats, so one member cannot hold many classes at once.
      const [{ pending }] = await tx.select({ pending: sql<number>`count(*)::int` }).from(bookings).innerJoin(lessons, eq(lessons.id, bookings.lessonId))
        .where(and(eq(bookings.memberId, user.id), eq(bookings.status, "pending"), gt(lessons.startsAt, new Date())));
      if (pending >= MAX_PENDING) throw new BookingError(`Onay bekleyen ${MAX_PENDING} talebin var. Eğitmen bunlara karar verdikten sonra yeni talep gönderebilirsin.`);

      const [{ taken }] = await tx.select({ taken: sql<number>`count(*)::int` }).from(bookings).where(and(eq(bookings.lessonId, lesson.id), inArray(bookings.status, ["pending", "approved"])));
      if (taken >= lesson.capacity) throw new BookingError("Son yer az önce doldu. Bekleme listesine katılabilir ya da başka bir saat seçebilirsin.", "full");

      // A request replaces waiting for this class.
      await tx.delete(waitlist).where(and(eq(waitlist.lessonId, lesson.id), eq(waitlist.memberId, user.id)));
      if (existing) {
        await tx.update(bookings).set({ ...freshBooking, status: "pending", memberNote: parsed.data.memberNote, memberNoteConsentAt: noteConsentAt, playlistUrl: parsed.data.playlistUrl, updatedAt: new Date() }).where(eq(bookings.id, existing.id));
        return existing.id;
      }
      const [created] = await tx.insert(bookings).values({ lessonId: lesson.id, memberId: user.id, memberNote: parsed.data.memberNote, memberNoteConsentAt: noteConsentAt, playlistUrl: parsed.data.playlistUrl }).returning({ id: bookings.id });
      return created.id;
    });
  } catch (error) {
    // Keep what the member typed, so losing the last seat does not also lose their note.
    if (error instanceof BookingError) return { error: error.message, code: error.code, values: keepValues(formData, ["memberNote", "playlistUrl"]) };
    throw error;
  }

  after(() => notifyBookingRequested(bookingId));
  redirect(`/rezervasyon/basarili?r=${bookingId}`);
}

export async function cancelBooking(_: FormState, formData: FormData): Promise<FormState> {
  const bookingId = String(formData.get("bookingId") ?? "");
  const user = await requireUser({ role: "member" });
  if (!isUuid(bookingId)) return { error: "Rezervasyon bulunamadı." };
  if (await hitRateLimit(`booking-cancel:${user.id}`, 20, 60 * 60 * 1000)) return { error: "Kısa sürede çok fazla işlem yaptın. Biraz sonra tekrar dene." };

  const db = await getDb();
  const [row] = await db.select({ status: bookings.status, startsAt: lessons.startsAt, lessonId: lessons.id }).from(bookings).innerJoin(lessons, eq(lessons.id, bookings.lessonId))
    .where(and(eq(bookings.id, bookingId), eq(bookings.memberId, user.id))).limit(1);
  if (!row) return { error: "Rezervasyon bulunamadı." };
  if (row.status !== "pending" && row.status !== "approved") return { error: "Bu rezervasyon zaten aktif değil." };
  const hoursLeft = (row.startsAt.getTime() - Date.now()) / 3_600_000;
  if (hoursLeft <= 0) return { error: "Başlamış bir ders iptal edilemez." };
  if (row.status === "approved" && hoursLeft < studio.cancellationHours) return { error: `Derse ${studio.cancellationHours} saatten az kaldığı için çevrimiçi iptal kapandı. Lütfen stüdyoyla iletişime geç.` };

  // Only if nothing changed since the checks above (e.g. the trainer deciding at the same moment).
  const changed = await db.update(bookings).set({ ...withdrawNote, status: "cancelled", updatedAt: new Date() })
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, row.status))).returning({ id: bookings.id });
  if (!changed.length) return { error: "Rezervasyonun az önce güncellendi. Sayfayı yenileyip tekrar dene." };
  after(async () => {
    await notifyBookingCancelled(bookingId);
    await notifySeatOpened(row.lessonId);
  });
  refresh();
  return { ok: true, message: "Rezervasyonun iptal edildi." };
}

export async function rescheduleBooking(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ role: "member" });
  const parsed = z.object({ bookingId: z.uuid(), lessonId: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Ders seçimi geçersiz." };
  if (await hitRateLimit(`booking-move:${user.id}`, 10, 60 * 60 * 1000)) return { error: "Kısa sürede çok fazla değişiklik yaptın. Biraz sonra tekrar dene." };
  const db = await getDb();
  let newBookingId: string;
  try {
    newBookingId = await db.transaction(async (tx) => {
      const [current] = await tx.select({ lessonId: bookings.lessonId, status: bookings.status, startsAt: lessons.startsAt })
        .from(bookings).innerJoin(lessons, eq(lessons.id, bookings.lessonId))
        .where(and(eq(bookings.id, parsed.data.bookingId), eq(bookings.memberId, user.id))).for("update");
      if (!current || !["pending", "approved"].includes(current.status)) throw new BookingError("Aktif rezervasyon bulunamadı.");
      if (current.lessonId === parsed.data.lessonId) throw new BookingError("Zaten bu derstesin.");
      const hoursLeft = (current.startsAt.getTime() - Date.now()) / 3_600_000;
      if (hoursLeft <= 0) throw new BookingError("Başlamış bir ders değiştirilemez.");
      if (current.status === "approved" && hoursLeft < studio.cancellationHours) throw new BookingError(`Derse ${studio.cancellationHours} saatten az kaldığı için çevrimiçi değişiklik kapandı.`);
      // Moving an approved seat creates a new waiting request, so it counts toward the same cap as a new booking.
      if (current.status === "approved") {
        const [{ pending }] = await tx.select({ pending: sql<number>`count(*)::int` }).from(bookings).innerJoin(lessons, eq(lessons.id, bookings.lessonId))
          .where(and(eq(bookings.memberId, user.id), eq(bookings.status, "pending"), gt(lessons.startsAt, new Date())));
        if (pending >= MAX_PENDING) throw new BookingError(`Onay bekleyen ${MAX_PENDING} talebin var. Eğitmen bunlara karar verdikten sonra dersini taşıyabilirsin.`);
      }

      const [target] = await tx.select({ id: lessons.id, status: lessons.status, startsAt: lessons.startsAt, capacity: lessons.capacity })
        .from(lessons).where(eq(lessons.id, parsed.data.lessonId)).for("update");
      if (!target || target.status !== "published" || target.startsAt.getTime() <= Date.now()) throw new BookingError("Seçtiğin ders artık uygun değil.");
      const [{ taken }] = await tx.select({ taken: sql<number>`count(*)::int` }).from(bookings)
        .where(and(eq(bookings.lessonId, target.id), inArray(bookings.status, ["pending", "approved"])));
      if (taken >= target.capacity) throw new BookingError("Seçtiğin ders doldu. Başka bir saat seçebilirsin.");
      const [existing] = await tx.select({ id: bookings.id, status: bookings.status }).from(bookings)
        .where(and(eq(bookings.lessonId, target.id), eq(bookings.memberId, user.id))).for("update");
      if (existing && ["pending", "approved"].includes(existing.status)) throw new BookingError("Bu ders için zaten aktif bir rezervasyonun var.");
      if (existing?.status === "rejected") throw new BookingError("Bu ders için talebin daha önce onaylanmadı. Başka bir saat seç.");

      await tx.update(bookings).set({ ...withdrawNote, status: "cancelled", updatedAt: new Date() }).where(eq(bookings.id, parsed.data.bookingId));
      // Moving into a class replaces waiting for it.
      await tx.delete(waitlist).where(and(eq(waitlist.lessonId, target.id), eq(waitlist.memberId, user.id)));
      if (existing) {
        await tx.update(bookings).set({ ...freshBooking, status: "pending", updatedAt: new Date() }).where(eq(bookings.id, existing.id));
        return existing.id;
      }
      const [created] = await tx.insert(bookings).values({ lessonId: target.id, memberId: user.id }).returning({ id: bookings.id });
      return created.id;
    });
  } catch (error) {
    if (error instanceof BookingError) return { error: error.message };
    throw error;
  }
  after(async () => {
    await notifyBookingCancelled(parsed.data.bookingId);
    await notifyBookingRequested(newBookingId);
    // The seat left behind goes to whoever is waiting for it.
    const [moved] = await (await getDb()).select({ lessonId: bookings.lessonId }).from(bookings).where(eq(bookings.id, parsed.data.bookingId)).limit(1);
    if (moved) await notifySeatOpened(moved.lessonId);
  });
  redirect(`/rezervasyon/basarili?r=${newBookingId}&degisti=1`);
}

export async function decideBooking(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ role: "trainer" });
  const parsed = z.object({ bookingId: z.uuid(), decision: z.enum(["approve", "reject"]), trainerNote: note, back: z.string().optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const db = await getDb();
  const [row] = await db.select({ status: bookings.status, startsAt: lessons.startsAt, lessonId: lessons.id }).from(bookings).innerJoin(lessons, eq(lessons.id, bookings.lessonId))
    .where(and(eq(bookings.id, parsed.data.bookingId), eq(lessons.trainerId, user.id))).limit(1);
  if (!row) return { error: "Talep bulunamadı." };
  if (row.status !== "pending") return { error: "Bu talep için daha önce karar verilmiş." };
  if (row.startsAt.getTime() <= Date.now()) return { error: "Ders başladığı için talep artık değiştirilemez." };

  // Still pending? The member may have withdrawn the request a moment ago.
  const decided = await db.update(bookings).set({ ...(parsed.data.decision === "reject" ? withdrawNote : {}), status: parsed.data.decision === "approve" ? "approved" : "rejected", trainerNote: parsed.data.trainerNote, decidedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(bookings.id, parsed.data.bookingId), eq(bookings.status, "pending"))).returning({ id: bookings.id });
  if (!decided.length) return { error: "Bu talep az önce değişti (üye geri çekmiş olabilir). Sayfayı yenile." };
  await audit(user.id, `booking.${parsed.data.decision}`, { type: "booking", id: parsed.data.bookingId });
  after(async () => {
    await notifyBookingDecision(parsed.data.bookingId);
    if (parsed.data.decision === "reject") await notifySeatOpened(row.lessonId);
  });
  if (parsed.data.back === "detail") redirect("/egitmen-paneli/talepler");
  refresh();
  return { ok: true };
}

/** Trainer books a member into one of their own classes; the seat is confirmed straight away. */
/**
 * Trainer books one or more members into an upcoming class (as many as there are free seats). All or
 * nothing: if the class cannot take everyone chosen, nobody is added and the trainer is told why.
 */
export async function addMemberToLesson(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ role: "trainer" });
  const parsed = z.object({
    lessonId: z.uuid(),
    memberIds: z.array(z.uuid()).min(1, { error: "Eklemek için en az bir üye seç." }).max(50),
  }).safeParse({ lessonId: formData.get("lessonId"), memberIds: [...new Set([...formData.getAll("memberIds"), ...formData.getAll("memberId")].map(String))] });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Eklemek için en az bir üye seç." };
  const { lessonId, memberIds } = parsed.data;
  // "Her hafta bu saate sabitle": the members also get this weekday and hour as a fixed time.
  const makeFixed = formData.get("fixed") === "on";

  const db = await getDb();
  let bookingIds: string[];
  let startsAt: Date;
  try {
    ({ ids: bookingIds, startsAt } = await db.transaction(async (tx) => {
      // Same lock as a member's request: the last seat can only be given once.
      const [lesson] = await tx.select({ id: lessons.id, status: lessons.status, startsAt: lessons.startsAt, capacity: lessons.capacity, trainerId: lessons.trainerId }).from(lessons).where(eq(lessons.id, lessonId)).for("update");
      // Any trainer may fill any class (they cover for each other); the class's own trainer is told.
      if (!lesson) throw new BookingError("Ders bulunamadı.");
      if (lesson.status !== "published") throw new BookingError("Bu ders iptal edilmiş.");
      if (lesson.startsAt.getTime() <= Date.now()) throw new BookingError("Başlamış bir derse üye eklenemez.");

      const found = await tx.select({ id: users.id }).from(users).where(and(inArray(users.id, memberIds), eq(users.role, "member"), isNull(users.deletedAt)));
      if (found.length !== memberIds.length) throw new BookingError("Seçilen üyelerden biri bulunamadı. Sayfayı yenile.");

      const existing = await tx.select({ id: bookings.id, memberId: bookings.memberId, status: bookings.status }).from(bookings)
        .where(and(eq(bookings.lessonId, lesson.id), inArray(bookings.memberId, memberIds)));
      const byMember = new Map(existing.map((row) => [row.memberId, row]));
      const toAdd = memberIds.filter((id) => byMember.get(id)?.status !== "approved");
      if (!toAdd.length) throw new BookingError(memberIds.length > 1 ? "Seçtiğin üyelerin hepsi zaten derste." : "Bu üye zaten derste.");

      // A pending request from the same member already holds a seat; approving it needs no free place.
      const needSeats = toAdd.filter((id) => byMember.get(id)?.status !== "pending").length;
      const [{ taken }] = await tx.select({ taken: sql<number>`count(*)::int` }).from(bookings).where(and(eq(bookings.lessonId, lesson.id), inArray(bookings.status, ["pending", "approved"])));
      const free = Math.max(lesson.capacity - taken, 0);
      if (needSeats > free) throw new BookingError(free ? `Bu derste ${free} boş yer var; ${needSeats} üye seçtin.` : "Bu derste boş yer yok.");

      const now = new Date();
      await tx.delete(waitlist).where(and(eq(waitlist.lessonId, lesson.id), inArray(waitlist.memberId, toAdd)));
      const ids: string[] = [];
      for (const memberId of toAdd) {
        const row = byMember.get(memberId);
        if (row) {
          // A pending request keeps the member's own note and playlist; an old cancelled row starts clean.
          await tx.update(bookings).set({ ...(row.status === "pending" ? {} : freshBooking), status: "approved", decidedAt: now, updatedAt: now }).where(eq(bookings.id, row.id));
          ids.push(row.id);
        } else {
          const [created] = await tx.insert(bookings).values({ lessonId: lesson.id, memberId, status: "approved", decidedAt: now }).returning({ id: bookings.id });
          ids.push(created.id);
        }
      }
      return { ids, startsAt: lesson.startsAt };
    }));
  } catch (error) {
    if (error instanceof BookingError) return { error: error.message };
    throw error;
  }

  for (const bookingId of bookingIds) await audit(user.id, "booking.add_member", { type: "booking", id: bookingId });
  after(async () => { for (const bookingId of bookingIds) await notifyMemberAdded(bookingId, { id: user.id, name: user.name }); });

  let fixedQuery = "";
  const slot = slotOf(startsAt);
  if (makeFixed && isFixedSlotWeekday(slot.weekday) && isFixedSlotTime(slot.startTime)) {
    let fixedCount = 0, later = 0, full = 0;
    for (const memberId of memberIds) {
      const slotId = await activateFixedSlot(memberId, slot);
      if (!slotId) continue;
      fixedCount++;
      // This week's seat belongs to the fixed time too, so the member can move just this week later.
      await db.update(bookings).set({ fixedSlotId: slotId }).where(and(eq(bookings.lessonId, lessonId), eq(bookings.memberId, memberId), eq(bookings.status, "approved")));
      await audit(user.id, "fixed_slot.assign", { type: "fixed_slot", id: slotId }, `üye ${memberId}`);
      const result = await fillFixedSlots({ slotId });
      later += result.booked.length; full += result.full.length;
      after(async () => {
        await notifyFixedSlotDecision(slotId, result.booked.length);
        await notifyFixedFill({ booked: [], full: result.full });
      });
    }
    fixedQuery = `&sabit=${fixedCount}&ileri=${later}&dolu=${full}`;
  } else if (makeFixed) fixedQuery = "&sabit=yok";
  redirect(`/egitmen-paneli/dersler/${lessonId}?eklendi=${bookingIds.join(",")}${fixedQuery}`);
}

/** Member adds, changes or removes their playlist suggestion before the class. */
/**
 * Trainer takes a member out of one of their upcoming classes (the counterpart of addMemberToLesson).
 * Only that class changes: a member who comes at a fixed weekly time keeps it, because the daily fill
 * never re-books a class the member already has a (cancelled) row for. The seat goes to the waitlist.
 */
export async function removeMemberFromLesson(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ role: "trainer" });
  const parsed = z.object({ bookingId: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Rezervasyon bulunamadı." };

  const db = await getDb();
  const [row] = await db.select({ status: bookings.status, lessonId: lessons.id, startsAt: lessons.startsAt, lessonStatus: lessons.status })
    .from(bookings).innerJoin(lessons, eq(lessons.id, bookings.lessonId)).where(eq(bookings.id, parsed.data.bookingId)).limit(1);
  if (!row) return { error: "Rezervasyon bulunamadı." };
  if (row.lessonStatus !== "published") return { error: "Bu ders iptal edilmiş." };
  if (row.startsAt.getTime() <= Date.now()) return { error: "Başlamış bir dersten üye çıkarılamaz; katılımı “Gelmedi” olarak işaretleyebilirsin." };

  const removed = await db.update(bookings).set({ ...withdrawNote, status: "cancelled", updatedAt: new Date() })
    .where(and(eq(bookings.id, parsed.data.bookingId), eq(bookings.status, "approved"))).returning({ id: bookings.id });
  if (!removed.length) return { error: "Bu üye zaten derste değil. Sayfayı yenile." };

  await audit(user.id, "booking.remove_member", { type: "booking", id: parsed.data.bookingId });
  after(async () => {
    await notifyMemberRemoved(parsed.data.bookingId, { id: user.id, name: user.name });
    await notifySeatOpened(row.lessonId);
  });
  redirect(`/egitmen-paneli/dersler/${row.lessonId}?cikarildi=${parsed.data.bookingId}`);
}

export async function updatePlaylist(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ role: "member" });
  const parsed = z.object({ bookingId: z.uuid(), playlistUrl: playlist }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: keepValues(formData, ["playlistUrl"]) };

  const db = await getDb();
  const [booking] = await db.select({ status: bookings.status, startsAt: lessons.startsAt }).from(bookings).innerJoin(lessons, eq(lessons.id, bookings.lessonId))
    .where(and(eq(bookings.id, parsed.data.bookingId), eq(bookings.memberId, user.id))).limit(1);
  if (!booking || (booking.status !== "pending" && booking.status !== "approved")) return { error: "Bu rezervasyon için liste eklenemez." };
  if (booking.startsAt.getTime() <= Date.now()) return { error: "Ders başladıktan sonra liste değiştirilemez." };

  await db.update(bookings).set({ playlistUrl: parsed.data.playlistUrl, updatedAt: new Date() }).where(eq(bookings.id, parsed.data.bookingId));
  refresh();
  return { ok: true, message: parsed.data.playlistUrl ? "Çalma listen eğitmenine iletildi." : "Çalma listesi kaldırıldı." };
}

/** Full class: the member asks to be told when a seat frees up. */
export async function joinWaitlist(_: FormState, formData: FormData): Promise<FormState> {
  const lessonId = String(formData.get("lessonId") ?? "");
  const user = await requireUser({ role: "member", next: `/dersler/${lessonId}` });
  if (!isUuid(lessonId)) return { error: "Ders bulunamadı." };

  const db = await getDb();
  const [lesson] = await db.select({ status: lessons.status, startsAt: lessons.startsAt, capacity: lessons.capacity,
    taken: sql<number>`(select count(*)::int from bookings b where b.lesson_id = "lessons"."id" and b.status in ('pending', 'approved'))`,
    mine: sql<number>`(select count(*)::int from bookings b where b.lesson_id = "lessons"."id" and b.member_id = ${user.id} and b.status in ('pending', 'approved'))` })
    .from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lesson || lesson.status !== "published" || lesson.startsAt.getTime() <= Date.now()) return { error: "Bu ders artık programda değil." };
  if (lesson.mine) return { error: "Bu derste zaten bir rezervasyonun var." };
  if (lesson.taken < lesson.capacity) return { error: "Bu derste şu an boş yer var; doğrudan talep gönderebilirsin." };

  await db.insert(waitlist).values({ lessonId, memberId: user.id }).onConflictDoNothing();
  refresh();
  return { ok: true, message: "Bekleme listesine eklendin. Yer açılınca sana haber vereceğiz." };
}

export async function leaveWaitlist(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ role: "member" });
  const lessonId = String(formData.get("lessonId") ?? "");
  if (!isUuid(lessonId)) return { error: "Ders bulunamadı." };
  await (await getDb()).delete(waitlist).where(and(eq(waitlist.lessonId, lessonId), eq(waitlist.memberId, user.id)));
  refresh();
  return { ok: true, message: "Bekleme listesinden çıktın." };
}
