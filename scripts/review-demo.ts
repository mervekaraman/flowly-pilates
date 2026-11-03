// Prepares the accounts Apple's App Review signs in with: a demo member, a demo trainer, four weeks of
// the trainer's classes (Mon–Fri 10:00 and 18:00) and two requests from the member, one approved and
// one waiting. Safe to run again: existing demo accounts get a new password and keep their data.
//
//   DATABASE_URL=… DEMO_EMAIL_BASE=studio@gmail.com DEMO_OUT=path node --import tsx scripts/review-demo.ts
//
// Addresses are plus-addresses of DEMO_EMAIL_BASE, so any e-mail they get lands in the studio inbox
// instead of bouncing. Passwords are random and written only to DEMO_OUT, never printed.
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { and, eq, gt, inArray, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { bookings, lessons, users } from "../src/db/schema";
import { poolConfig } from "../src/db/pool-config";
import { hashPassword } from "../src/lib/auth/password";
import { addDays, atStudioTime, todayKey } from "../src/lib/format";
import { lessonDefaults } from "../src/lib/studio";

const url = process.env.DATABASE_URL, base = process.env.DEMO_EMAIL_BASE, out = process.env.DEMO_OUT;
if (!url || !base?.includes("@") || !out) {
  console.error("DATABASE_URL, DEMO_EMAIL_BASE ve DEMO_OUT gerekli.");
  process.exit(1);
}
const [local, domain] = base.toLowerCase().split("@");
const address = (tag: string) => `${local.split("+")[0]}+${tag}@${domain}`;
const newPassword = () => `Flowly-${randomBytes(9).toString("base64url")}`;

const pool = new Pool(poolConfig(url, 1));
const db = drizzle(pool);

async function account(email: string, name: string, role: "member" | "trainer", password: string) {
  const passwordHash = await hashPassword(password);
  const [found] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (found) {
    await db.update(users).set({ name, passwordHash, passwordSet: true, deletedAt: null }).where(eq(users.id, found.id));
    return found.id;
  }
  const [created] = await db.insert(users).values({ name, email, role, passwordHash, emailNotifications: false }).returning({ id: users.id });
  return created.id;
}

async function main() {
  const member = { email: address("uye"), password: newPassword() };
  const trainer = { email: address("egitmen"), password: newPassword() };
  const memberId = await account(member.email, "Demo Üye", "member", member.password);
  const trainerId = await account(trainer.email, "Demo Eğitmen", "trainer", trainer.password);

  // Weekdays of the next four weeks, skipping any hour another class already holds.
  const opened: { id: string; startsAt: Date }[] = [];
  for (let offset = 1; offset <= 28; offset++) {
    const day = addDays(todayKey(), offset);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    for (const time of ["10:00", "18:00"]) {
      const startsAt = atStudioTime(day, time);
      const endsAt = new Date(startsAt.getTime() + lessonDefaults.durationMin * 60_000);
      const [clash] = await db.select({ id: lessons.id, trainerId: lessons.trainerId }).from(lessons)
        .where(and(eq(lessons.status, "published"), lt(lessons.startsAt, endsAt), gt(lessons.endsAt, startsAt))).limit(1);
      if (clash) {
        if (clash.trainerId === trainerId) opened.push({ id: clash.id, startsAt });
        continue;
      }
      const [lesson] = await db.insert(lessons).values({ trainerId, type: "reformer", level: "tum", startsAt, endsAt, durationMin: lessonDefaults.durationMin, capacity: lessonDefaults.capacity })
        .returning({ id: lessons.id });
      opened.push({ id: lesson.id, startsAt });
    }
  }

  // Two requests early in the review window: the first approved, the second waiting for the trainer.
  const [approved, waiting] = opened.slice(2, 4);
  for (const [lesson, status] of [[approved, "approved"], [waiting, "pending"]] as const) {
    await db.insert(bookings).values({ lessonId: lesson.id, memberId, status, decidedAt: status === "approved" ? new Date() : null })
      .onConflictDoUpdate({ target: [bookings.lessonId, bookings.memberId], set: { status, decidedAt: status === "approved" ? new Date() : null, updatedAt: new Date() } });
  }
  const demoBookings = await db.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.memberId, memberId), inArray(bookings.lessonId, opened.map((l) => l.id))));

  writeFileSync(out!, [
    `APPLE_REVIEW_MEMBER_EMAIL=${member.email}`, `APPLE_REVIEW_MEMBER_PASSWORD=${member.password}`,
    `APPLE_REVIEW_TRAINER_EMAIL=${trainer.email}`, `APPLE_REVIEW_TRAINER_PASSWORD=${trainer.password}`, "",
  ].join("\n"), { mode: 0o600 });
  console.log(`Demo hesaplar hazır. Demo eğitmenin ${opened.length} dersi var; demo üyenin ${demoBookings.length} talebi var (1 onaylı, 1 bekliyor).`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
