import { sql } from "drizzle-orm";
import { addDays, atStudioTime, isSunday, todayKey } from "@/lib/format";
import { hashPassword } from "@/lib/auth/password";
import { lessonDefaults } from "@/lib/studio";
import type { Db } from "./index";
import { bookings, lessons, notifications, reviews, users } from "./schema";

// Demo data for local development only (runs once, on an empty local database).
// Every demo account uses this password; see README › "Demo hesaplar".
export const DEMO_PASSWORD = "smeda-demo-2026";

type Slot = { time: string; trainer: "duygu" | "ece"; level: "tum" | "baslangic" | "orta" | "ileri"; days?: number[] };

// Classes start on the hour. Weekday numbers: 1 = Monday … 6 = Saturday.
const weeklySlots: Slot[] = [
  { time: "09:00", trainer: "duygu", level: "tum" },
  { time: "12:00", trainer: "ece", level: "baslangic", days: [2, 4, 6] },
  { time: "18:00", trainer: "duygu", level: "orta", days: [1, 2, 3, 4, 5] },
  { time: "19:00", trainer: "ece", level: "ileri", days: [1, 3, 5] },
];

const weekday = (day: string) => atStudioTime(day, "12:00").getUTCDay();

export async function seedDemoData(db: Db) {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  if (count > 0) return;

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const people = await db.insert(users).values([
    { name: "Duygu Kaya", email: "duygu@demo.smeda.test", phone: "+90 555 000 00 01", role: "trainer", passwordHash, bio: "Reformer pilates eğitmeni. Dersleri nefesle uyumlu, kontrollü ve her katılımcının seviyesine göre uyarlanmış ilerler." },
    { name: "Ece Sarı", email: "ece@demo.smeda.test", phone: "+90 555 000 00 02", role: "trainer", passwordHash, bio: "Reformer ve postür odaklı çalışır. Pilatese yeni başlayanlara sabırla eşlik eder, ileri seviyede tempoyu artırır." },
    { name: "Elif Yılmaz", email: "elif@demo.smeda.test", phone: "+90 555 000 00 10", role: "member", passwordHash },
    { name: "Selin Aras", email: "selin@demo.smeda.test", phone: "+90 555 000 00 11", role: "member", passwordHash },
    { name: "Zeynep Tan", email: "zeynep@demo.smeda.test", phone: "+90 555 000 00 12", role: "member", passwordHash },
    { name: "Ceren Ak", email: "ceren@demo.smeda.test", phone: "+90 555 000 00 13", role: "member", passwordHash },
    { name: "Derya Aksoy", email: "derya@demo.smeda.test", phone: "+90 555 000 00 14", role: "member", passwordHash },
  ]).returning({ id: users.id, email: users.email });
  const id = (prefix: string) => people.find((person) => person.email.startsWith(`${prefix}@`))!.id;
  const trainers = { duygu: id("duygu"), ece: id("ece") };

  // Lessons from nine days ago to twelve days ahead, Monday–Saturday.
  const today = todayKey();
  const lessonRows: (typeof lessons.$inferInsert)[] = [];
  for (let offset = -9; offset <= 12; offset++) {
    const day = addDays(today, offset);
    if (isSunday(day)) continue;
    for (const slot of weeklySlots) {
      if (slot.days && !slot.days.includes(weekday(day))) continue;
      const startsAt = atStudioTime(day, slot.time);
      const endsAt = new Date(startsAt.getTime() + lessonDefaults.durationMin * 60_000);
      lessonRows.push({ trainerId: trainers[slot.trainer], type: "reformer", level: slot.level, startsAt, endsAt, ...lessonDefaults });
    }
  }
  const created = await db.insert(lessons).values(lessonRows).returning({ id: lessons.id, startsAt: lessons.startsAt, trainerId: lessons.trainerId, capacity: lessons.capacity });

  const now = Date.now();
  const upcoming = created.filter((lesson) => lesson.startsAt.getTime() > now).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const past = created.filter((lesson) => lesson.startsAt.getTime() < now).sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  const at = (list: typeof created, time: string, nth = 0) => list.filter((lesson) => new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" }).format(lesson.startsAt) === time)[nth];

  const booking = (lesson: (typeof created)[number] | undefined, member: string, status: "pending" | "approved", memberNote?: string) =>
    lesson ? { lessonId: lesson.id, memberId: id(member), status, memberNote, memberNoteConsentAt: memberNote ? new Date() : null, decidedAt: status === "approved" ? new Date(lesson.startsAt.getTime() - 2 * 24 * 60 * 60 * 1000) : null, attendance: status === "approved" && lesson.startsAt.getTime() < now ? "attended" as const : null, attendanceMarkedAt: status === "approved" && lesson.startsAt.getTime() < now ? new Date(lesson.startsAt.getTime() + lessonDefaults.durationMin * 60_000) : null } : null;

  const fullLesson = at(upcoming, "12:00");
  const bookingRows = [
    // Elif's own week: one confirmed class, one waiting for approval.
    booking(at(upcoming, "18:00"), "elif", "approved"),
    booking(at(upcoming, "09:00", 2), "elif", "pending"),
    // Requests waiting for the trainers.
    booking(at(upcoming, "18:00", 1), "selin", "pending", "Bel hassasiyetim var; kontrollü çalışmayı tercih ediyorum."),
    booking(at(upcoming, "09:00", 1), "zeynep", "pending"),
    booking(at(upcoming, "18:00", 2), "ceren", "pending", "İlk reformer dersim olacak."),
    booking(at(upcoming, "18:00"), "derya", "approved"),
    // A beginner class that is already full.
    ...["selin", "zeynep", "ceren", "derya"].map((member) => booking(fullLesson, member, "approved")),
    // History: attended classes, most of them reviewed.
    booking(at(past, "18:00"), "elif", "approved"),
    booking(at(past, "09:00", 2), "elif", "approved"),
    booking(at(past, "18:00", 1), "derya", "approved"),
    booking(at(past, "09:00", 1), "selin", "approved"),
    booking(at(past, "19:00"), "zeynep", "approved"),
    booking(at(past, "12:00"), "ceren", "approved"),
  ].filter((row): row is NonNullable<typeof row> => row !== null);
  const createdBookings = await db.insert(bookings).values(bookingRows).returning({ id: bookings.id, lessonId: bookings.lessonId, memberId: bookings.memberId });

  const pastBooking = (member: string, lesson: (typeof created)[number] | undefined) => createdBookings.find((row) => row.memberId === id(member) && row.lessonId === lesson?.id);
  const review = (member: string, lesson: (typeof created)[number] | undefined, rating: number, comment: string) => {
    const row = pastBooking(member, lesson);
    return row && lesson ? { bookingId: row.id, memberId: id(member), trainerId: lesson.trainerId, rating, comment, recommendsTrainer: rating >= 4, recommendsStudio: true, createdAt: new Date(lesson.startsAt.getTime() + 3 * 60 * 60 * 1000) } : null;
  };
  await db.insert(reviews).values([
    review("elif", at(past, "09:00", 2), 5, "Stüdyo çok ferah, Duygu Hoca her hareketi tek tek düzeltti. Dersten sonra kendimi çok hafif hissettim."),
    review("derya", at(past, "18:00", 1), 5, "Ders temposu dengeliydi, grup küçük olduğu için herkese ayrı ayrı vakit ayrıldı."),
    review("selin", at(past, "09:00", 1), 4, "Ortam sakin ve tertemiz. Sabah dersi güne başlamak için harika."),
    review("zeynep", at(past, "19:00"), 5, "İleri seviye ders gerçekten zorlayıcıydı ama Ece Hoca güvenli sınırları çok iyi koruyor."),
    review("ceren", at(past, "12:00"), 4, "Başlangıç dersi tam ihtiyacım olan şeydi; aletleri adım adım öğrendik."),
  ].filter((row): row is NonNullable<typeof row> => row !== null));

  await db.insert(notifications).values([
    { userId: id("elif"), kind: "approved", title: "Rezervasyonun onaylandı", body: "Reformer Pilates dersin kesinleşti.", href: "/rezervasyonlar" },
    { userId: id("elif"), kind: "review", title: "Dersin nasıldı?", body: "Son dersini değerlendirerek eğitmenine geri bildirim verebilirsin.", href: "/rezervasyonlar?sekme=gecmis", readAt: new Date() },
    { userId: trainers.duygu, kind: "request", title: "Yeni rezervasyon talepleri", body: "Onay bekleyen talepler var.", href: "/egitmen-paneli/talepler" },
  ]);
}
