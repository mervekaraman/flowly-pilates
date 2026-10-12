import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { bookings, lessons, notifications, pushSubscriptions, reviews, users, waitlist } from "@/db/schema";
import { getCurrentUser } from "@/lib/dal";

// KVKK md. 11 (right of access): everything stored about the signed-in person, as a JSON download.
// Secrets (password hash, session and link tokens, push keys) are never included.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Giriş yapmalısın.", { status: 401 });
  const db = await getDb();
  const trainer = alias(users, "trainer");

  const [profile] = await db.select({ name: users.name, email: users.email, phone: users.phone, role: users.role, bio: users.bio, emailNotifications: users.emailNotifications, createdAt: users.createdAt })
    .from(users).where(eq(users.id, user.id));
  const myBookings = await db.select({
    lesson: lessons.startsAt, durationMin: lessons.durationMin, level: lessons.level, trainer: trainer.name, status: bookings.status,
    note: bookings.memberNote, noteConsentAt: bookings.memberNoteConsentAt, trainerNote: bookings.trainerNote, playlist: bookings.playlistUrl,
    attendance: bookings.attendance, effort: bookings.effort, requestedAt: bookings.createdAt, decidedAt: bookings.decidedAt,
  }).from(bookings).innerJoin(lessons, eq(lessons.id, bookings.lessonId)).innerJoin(trainer, eq(trainer.id, lessons.trainerId))
    .where(eq(bookings.memberId, user.id)).orderBy(asc(lessons.startsAt));
  const myReviews = await db.select({ rating: reviews.rating, comment: reviews.comment, recommendsTrainer: reviews.recommendsTrainer, recommendsStudio: reviews.recommendsStudio, createdAt: reviews.createdAt })
    .from(reviews).where(eq(reviews.memberId, user.id));
  const myWaitlist = await db.select({ lesson: lessons.startsAt, joinedAt: waitlist.createdAt }).from(waitlist).innerJoin(lessons, eq(lessons.id, waitlist.lessonId)).where(eq(waitlist.memberId, user.id));
  const myNotifications = await db.select({ title: notifications.title, body: notifications.body, createdAt: notifications.createdAt, readAt: notifications.readAt }).from(notifications).where(eq(notifications.userId, user.id));
  const devices = await db.select({ createdAt: pushSubscriptions.createdAt }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id));

  const body = JSON.stringify({
    exportedAt: new Date().toISOString(),
    note: "Flowly Pilates uygulamasında senin hakkında tutulan veriler (KVKK md. 11). Şifren yalnızca geri döndürülemez biçimde saklandığı için bu dosyada yer almaz.",
    profile, bookings: myBookings, reviews: myReviews, waitlist: myWaitlist, notifications: myNotifications,
    notificationDevices: devices.map((device) => ({ addedAt: device.createdAt })),
  }, null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="flowly-pilates-verilerim-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
