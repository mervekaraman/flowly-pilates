import "server-only";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings, fixedSlots, lessons, waitlist } from "@/db/schema";
import { autoBookCutoff, matchesSlot } from "@/lib/fixed-slot-rules";
import { studio } from "@/lib/studio";

export type FixedFillResult = {
  /** Bookings created for members' fixed times, already approved. */
  booked: string[];
  /** Classes that were full; the member was put on the waitlist instead (once per class). */
  full: { memberId: string; lessonId: string }[];
};

/**
 * Books members with an approved fixed weekly time into every upcoming class at that time.
 *
 * Runs when a trainer approves a fixed time, when new classes are published and once a day. It is
 * safe to run any number of times: a member who already has any booking row for a class (including
 * one they cancelled, or one a trainer rejected) is left alone, so cancelling a single week sticks.
 */
export async function fillFixedSlots(scope: { slotId?: string; lessonIds?: string[] } = {}): Promise<FixedFillResult> {
  const result: FixedFillResult = { booked: [], full: [] };
  if (scope.lessonIds && !scope.lessonIds.length) return result;
  const db = await getDb();

  const slots = await db.select({ id: fixedSlots.id, memberId: fixedSlots.memberId, weekday: fixedSlots.weekday, startTime: fixedSlots.startTime })
    .from(fixedSlots).where(and(eq(fixedSlots.status, "active"), scope.slotId ? eq(fixedSlots.id, scope.slotId) : undefined));
  if (!slots.length) return result;

  const cutoff = autoBookCutoff(studio.cancellationHours);
  const upcoming = await db.select({ id: lessons.id, startsAt: lessons.startsAt }).from(lessons)
    .where(and(eq(lessons.status, "published"), gt(lessons.startsAt, cutoff), scope.lessonIds ? inArray(lessons.id, scope.lessonIds) : undefined));

  for (const slot of slots) {
    for (const lesson of upcoming.filter((row) => matchesSlot(row.startsAt, slot))) {
      const outcome = await db.transaction(async (tx) => {
        // Same lock as a member's own request, so the last seat is never given twice.
        const [locked] = await tx.select({ status: lessons.status, startsAt: lessons.startsAt, capacity: lessons.capacity }).from(lessons).where(eq(lessons.id, lesson.id)).for("update");
        if (!locked || locked.status !== "published" || locked.startsAt <= cutoff) return null;
        // The slot may have been ended a moment ago.
        const [still] = await tx.select({ id: fixedSlots.id }).from(fixedSlots).where(and(eq(fixedSlots.id, slot.id), eq(fixedSlots.status, "active")));
        if (!still) return null;
        const [existing] = await tx.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.lessonId, lesson.id), eq(bookings.memberId, slot.memberId)));
        if (existing) return null;

        const [{ taken }] = await tx.select({ taken: sql<number>`count(*)::int` }).from(bookings).where(and(eq(bookings.lessonId, lesson.id), inArray(bookings.status, ["pending", "approved"])));
        if (taken >= locked.capacity) {
          const added = await tx.insert(waitlist).values({ lessonId: lesson.id, memberId: slot.memberId }).onConflictDoNothing().returning({ id: waitlist.id });
          return added.length ? { kind: "full" as const } : null;
        }
        await tx.delete(waitlist).where(and(eq(waitlist.lessonId, lesson.id), eq(waitlist.memberId, slot.memberId)));
        const now = new Date();
        const [created] = await tx.insert(bookings).values({ lessonId: lesson.id, memberId: slot.memberId, status: "approved", decidedAt: now, fixedSlotId: slot.id }).returning({ id: bookings.id });
        return { kind: "booked" as const, bookingId: created.id };
      });
      if (outcome?.kind === "booked") result.booked.push(outcome.bookingId);
      else if (outcome?.kind === "full") result.full.push({ memberId: slot.memberId, lessonId: lesson.id });
    }
  }
  return result;
}

/**
 * Ends a fixed time and gives back the seats it booked that can still be cancelled online.
 * Classes closer than the cancellation limit keep the booking, exactly as a manual cancel would.
 */
export async function endFixedSlot(slotId: string, by: { memberId?: string }) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const ended = await tx.update(fixedSlots).set({ status: "ended", endedAt: new Date() })
      .where(and(eq(fixedSlots.id, slotId), inArray(fixedSlots.status, ["pending", "active"]), by.memberId ? eq(fixedSlots.memberId, by.memberId) : undefined))
      .returning({ id: fixedSlots.id, memberId: fixedSlots.memberId });
    if (!ended.length) return null;
    const freed = await tx.update(bookings).set({ status: "cancelled", memberNote: null, memberNoteConsentAt: null, updatedAt: new Date() })
      .where(and(eq(bookings.fixedSlotId, slotId), inArray(bookings.status, ["pending", "approved"]),
        inArray(bookings.lessonId, tx.select({ id: lessons.id }).from(lessons).where(gt(lessons.startsAt, autoBookCutoff(studio.cancellationHours))))))
      .returning({ id: bookings.id, lessonId: bookings.lessonId });
    const kept = await tx.select({ count: sql<number>`count(*)::int` }).from(bookings).innerJoin(lessons, eq(lessons.id, bookings.lessonId))
      .where(and(eq(bookings.fixedSlotId, slotId), inArray(bookings.status, ["pending", "approved"]), gt(lessons.startsAt, new Date())));
    return { memberId: ended[0].memberId, freed, kept: kept[0]?.count ?? 0 };
  });
}
