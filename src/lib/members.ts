import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings, fixedSlots, memberPackages, notifications, reviews, users, waitlist } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";

/**
 * A member the studio books for before they are in the app: name only. The e-mail is a reserved
 * .invalid address (the column is required and unique; mail to it is never sent, see lib/mail.ts)
 * and the random password is never shown, so nobody can sign in to it.
 */
export async function createPlaceholderMember(name: string) {
  const db = await getDb();
  const [created] = await db.insert(users).values({
    name, email: `hesapsiz-${randomUUID()}@uye.flowly.invalid`, phone: null, role: "member", placeholder: true,
    passwordSet: false, emailNotifications: false, passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
  }).returning({ id: users.id, name: users.name });
  return created;
}

export type MergeResult = { bookings: number; packages: number; fixedSlots: number };

/**
 * Moves everything a placeholder holds (bookings, attendance, packages, fixed times, waitlist places,
 * reviews) to the member's real account, then deletes the placeholder. Where both accounts already
 * have the same class or the same open fixed time, the real account's row wins.
 */
export async function mergePlaceholder(placeholderId: string, memberId: string): Promise<MergeResult | { error: string }> {
  if (placeholderId === memberId) return { error: "Aynı hesabı kendisiyle birleştiremezsin." };
  const db = await getDb();
  return db.transaction(async (tx) => {
    const rows = await tx.select({ id: users.id, role: users.role, placeholder: users.placeholder, deletedAt: users.deletedAt })
      .from(users).where(inArray(users.id, [placeholderId, memberId])).for("update");
    const from = rows.find((row) => row.id === placeholderId);
    const to = rows.find((row) => row.id === memberId);
    if (!from?.placeholder) return { error: "Yalnızca hesapsız açılan üyeler birleştirilebilir." };
    if (!to || to.role !== "member" || to.placeholder || to.deletedAt) return { error: "Birleştirilecek gerçek üye hesabını seç." };

    // Same class on both accounts: keep the real account's booking (and its waitlist place).
    await tx.delete(bookings).where(and(eq(bookings.memberId, placeholderId),
      inArray(bookings.lessonId, tx.select({ id: bookings.lessonId }).from(bookings).where(eq(bookings.memberId, memberId)))));
    const movedBookings = await tx.update(bookings).set({ memberId, updatedAt: new Date() }).where(eq(bookings.memberId, placeholderId)).returning({ id: bookings.id });

    await tx.delete(waitlist).where(and(eq(waitlist.memberId, placeholderId), sql`${waitlist.lessonId} in (
      select lesson_id from waitlist where member_id = ${memberId} union select lesson_id from bookings where member_id = ${memberId})`));
    await tx.update(waitlist).set({ memberId }).where(eq(waitlist.memberId, placeholderId));

    // An open time the real account already has (active or requested) ends on the placeholder.
    await tx.update(fixedSlots).set({ status: "ended", endedAt: new Date() }).where(and(eq(fixedSlots.memberId, placeholderId), inArray(fixedSlots.status, ["pending", "active"]),
      sql`(${fixedSlots.weekday}, ${fixedSlots.startTime}) in (select weekday, start_time from fixed_slots where member_id = ${memberId} and status in ('pending', 'active'))`));
    const movedSlots = await tx.update(fixedSlots).set({ memberId }).where(eq(fixedSlots.memberId, placeholderId)).returning({ id: fixedSlots.id, status: fixedSlots.status });

    const movedPackages = await tx.update(memberPackages).set({ memberId }).where(eq(memberPackages.memberId, placeholderId)).returning({ id: memberPackages.id });
    await tx.update(reviews).set({ memberId }).where(eq(reviews.memberId, placeholderId));
    await tx.delete(notifications).where(eq(notifications.userId, placeholderId));
    await tx.delete(users).where(eq(users.id, placeholderId));
    return { bookings: movedBookings.length, packages: movedPackages.length, fixedSlots: movedSlots.filter((slot) => slot.status === "active").length };
  });
}
