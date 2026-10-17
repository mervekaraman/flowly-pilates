import "server-only";
import { and, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings, emailChangeTokens, emailOutbox, lessons, notifications, passwordResetTokens, rateLimits, sessions, waitlist } from "@/db/schema";
import { addDays, atStudioTime, todayKey } from "@/lib/format";
import { isMailConfigured, retryFailedEmails } from "@/lib/mail";
import { notifyLessonReminder } from "@/lib/notify";

const DAY = 24 * 60 * 60 * 1000;

/** Reminds members with a confirmed seat in tomorrow's classes (Istanbul calendar day). */
export async function sendTomorrowReminders() {
  const db = await getDb();
  const tomorrow = addDays(todayKey(), 1);
  const from = atStudioTime(tomorrow, "00:00");
  const to = atStudioTime(addDays(tomorrow, 1), "00:00");
  // Claim the rows first (reminder_sent_at) so a retried or overlapping run never sends twice.
  const due = await db.update(bookings).set({ reminderSentAt: new Date() })
    .where(and(eq(bookings.status, "approved"), isNull(bookings.reminderSentAt), inArray(bookings.lessonId,
      db.select({ id: lessons.id }).from(lessons).where(and(eq(lessons.status, "published"), gte(lessons.startsAt, from), lt(lessons.startsAt, to))))))
    .returning({ id: bookings.id });
  for (const booking of due) {
    try {
      await notifyLessonReminder(booking.id);
    } catch (error) {
      // Only the error's kind and code: database errors can echo query values (names, e-mails).
      const { name, code } = error as { name?: string; code?: string };
      console.error("[hatırlatma] gönderilemedi", booking.id, name ?? "Error", code ?? "");
    }
  }
  return due.length;
}

/**
 * Data minimisation (KVKK) and a small database: copies of sent e-mails are kept 30 days, health-
 * related notes on bookings are cleared 6 months after the class, expired secrets go at once.
 */
export async function cleanUp() {
  const db = await getDb();
  const now = Date.now();
  const count = async (query: Promise<unknown[]>) => (await query).length;
  return {
    outbox: await count(db.delete(emailOutbox).where(lt(emailOutbox.createdAt, new Date(now - 30 * DAY))).returning({ id: emailOutbox.id })),
    sessions: await count(db.delete(sessions).where(lt(sessions.expiresAt, new Date(now))).returning({ id: sessions.id })),
    resetTokens: await count(db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, new Date(now - DAY))).returning({ id: passwordResetTokens.id })),
    emailTokens: await count(db.delete(emailChangeTokens).where(lt(emailChangeTokens.expiresAt, new Date(now - DAY))).returning({ id: emailChangeTokens.id })),
    notifications: await count(db.delete(notifications).where(and(isNotNull(notifications.readAt), lt(notifications.createdAt, new Date(now - 365 * DAY)))).returning({ id: notifications.id })),
    rateLimits: await count(db.delete(rateLimits).where(lt(rateLimits.resetAt, new Date(now - DAY))).returning({ key: rateLimits.key })),
    // Health-related notes are only needed around the class itself.
    notes: await count(db.update(bookings).set({ memberNote: null, memberNoteConsentAt: null, trainerNote: null })
      .where(and(or(isNotNull(bookings.memberNote), isNotNull(bookings.trainerNote)), inArray(bookings.lessonId, db.select({ id: lessons.id }).from(lessons).where(lt(lessons.startsAt, new Date(now - 182 * DAY)))))).returning({ id: bookings.id })),
    waitlist: await count(db.delete(waitlist).where(inArray(waitlist.lessonId, db.select({ id: lessons.id }).from(lessons).where(lt(lessons.startsAt, sql`now()`)))).returning({ id: waitlist.id })),
  };
}

/** Second chance for e-mails that failed (SMTP hiccups); secret links are never replayed. */
export async function retryMail() {
  if (!isMailConfigured()) return { attempted: 0, sent: 0 };
  return retryFailedEmails();
}
