import "server-only";
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { bookings, lessons, notifications, users, waitlist, type NotificationKind } from "@/db/schema";
import { formatDayLong, formatTime, lessonLevelLabels, lessonTypeLabels } from "@/lib/format";
import { bookingIcsFile } from "@/lib/booking-calendar";
import { sendEmail } from "@/lib/mail";
import { sendPush } from "@/lib/push";
import { studio } from "@/lib/studio";

// Booking events fan out to an in-app notification and (if the person allows it) an e-mail.
// Callers run these inside `after()` so a slow SMTP server never delays the response.

const member = alias(users, "member");
const trainer = alias(users, "trainer");

async function loadBooking(bookingId: string) {
  const db = await getDb();
  const [row] = await db.select({ booking: bookings, lesson: lessons, member, trainer })
    .from(bookings).innerJoin(lessons, eq(lessons.id, bookings.lessonId))
    .innerJoin(member, eq(member.id, bookings.memberId)).innerJoin(trainer, eq(trainer.id, lessons.trainerId))
    .where(eq(bookings.id, bookingId)).limit(1);
  return row;
}

type Row = NonNullable<Awaited<ReturnType<typeof loadBooking>>>;
const lessonTitle = (lesson: Row["lesson"]) => lessonTypeLabels[lesson.type];
const when = (lesson: Row["lesson"]) => `${formatDayLong(lesson.startsAt)}, ${formatTime(lesson.startsAt)}`;
const lessonDetails = (row: Row): [string, string][] => [
  ["Ders", `${lessonTitle(row.lesson)} · ${lessonLevelLabels[row.lesson.level]}`],
  ["Tarih", formatDayLong(row.lesson.startsAt)],
  ["Saat", `${formatTime(row.lesson.startsAt)} · ${row.lesson.durationMin} dk`],
  ["Eğitmen", row.trainer.name],
];

/** In-app notification, mirrored as a Web Push to the person's devices (if they allowed it). */
const calendarFor = (row: Row, cancelled = false) => bookingIcsFile({ id: row.booking.id, startsAt: row.lesson.startsAt, durationMin: row.lesson.durationMin, level: row.lesson.level, trainerName: row.trainer.name, cancelled, changedAt: row.booking.updatedAt });

async function inApp(userId: string, kind: NotificationKind, title: string, body: string, href: string, { push = true } = {}) {
  await (await getDb()).insert(notifications).values({ userId, kind, title, body, href });
  // Same tag per page: a newer update (e.g. "onaylandı") replaces the older one on the lock screen.
  if (push) await sendPush(userId, { title, body, url: href, tag: href });
}

export async function notifyBookingRequested(bookingId: string) {
  const row = await loadBooking(bookingId);
  if (!row) return;
  await inApp(row.member.id, "request", "Rezervasyon talebin alındı", `${lessonTitle(row.lesson)} · ${when(row.lesson)} — eğitmen onayı bekleniyor.`, `/rezervasyonlar/${row.booking.id}`, { push: false });
  await inApp(row.trainer.id, "request", "Yeni rezervasyon talebi", `${row.member.name} · ${when(row.lesson)}`, `/egitmen-paneli/talepler/${row.booking.id}`);
  if (row.member.emailNotifications) await sendEmail({
    to: row.member.email, subject: `Talebin alındı · ${formatDayLong(row.lesson.startsAt)} ${formatTime(row.lesson.startsAt)}`,
    heading: "Rezervasyon talebin alındı.",
    paragraphs: [`Merhaba ${row.member.name.split(" ")[0]}, ${studio.name} için talebini aldık. Eğitmen onayladığında sana tekrar haber vereceğiz.`],
    details: lessonDetails(row), action: { label: "Talebi gör", href: `/rezervasyonlar/${row.booking.id}` },
  });
  if (row.trainer.emailNotifications) await sendEmail({
    to: row.trainer.email, subject: `Yeni talep · ${formatDayLong(row.lesson.startsAt)} ${formatTime(row.lesson.startsAt)}`,
    heading: "Yeni bir rezervasyon talebin var.",
    paragraphs: [
      `${row.member.name}, ${when(row.lesson)} dersin için yer istedi.`,
      // The note may hold health data (KVKK md. 6): it stays in the app, never in a mailbox.
      ...(row.booking.memberNote ? ["Üyenin sana bir notu var; talebi açınca görebilirsin."] : []),
      ...(row.booking.playlistUrl ? [`Üyenin müzik önerisi (Spotify): ${row.booking.playlistUrl}`] : []),
    ],
    details: lessonDetails(row).slice(0, 3), action: { label: "Talebi incele", href: `/egitmen-paneli/talepler/${row.booking.id}` },
  });
}

export async function notifyBookingDecision(bookingId: string) {
  const row = await loadBooking(bookingId);
  if (!row || (row.booking.status !== "approved" && row.booking.status !== "rejected")) return;
  const approved = row.booking.status === "approved";
  await inApp(row.member.id, approved ? "approved" : "rejected", approved ? "Rezervasyonun onaylandı" : "Rezervasyon talebin onaylanmadı", `${lessonTitle(row.lesson)} · ${when(row.lesson)}`, `/rezervasyonlar/${row.booking.id}`);
  if (!row.member.emailNotifications) return;
  await sendEmail({
    to: row.member.email,
    subject: approved ? `Rezervasyonun onaylandı · ${formatDayLong(row.lesson.startsAt)}` : "Rezervasyon talebin hakkında",
    heading: approved ? "Yerin hazır, görüşmek üzere." : "Bu derste yer açamadık.",
    paragraphs: [
      approved ? `${row.trainer.name} talebini onayladı. Dersten birkaç dakika önce stüdyoda olman yeterli.` : `${row.trainer.name} bu ders için talebini onaylayamadı. Programdan sana uygun başka bir saat seçebilirsin.`,
      ...(row.booking.trainerNote ? [`Eğitmenin notu: “${row.booking.trainerNote}”`] : []),
      ...(approved ? [`Derse ${studio.cancellationHours} saat kalana kadar iptal edebilirsin.`] : []),
    ],
    details: lessonDetails(row),
    action: approved ? { label: "Rezervasyonu gör", href: `/rezervasyonlar/${row.booking.id}` } : { label: "Ders programına git", href: "/dersler" },
    calendar: approved ? { ics: calendarFor(row) } : undefined,
  });
}

/** The trainer put the member into a class directly; the seat is already confirmed. */
export async function notifyMemberAdded(bookingId: string) {
  const row = await loadBooking(bookingId);
  if (!row || row.booking.status !== "approved") return;
  await inApp(row.member.id, "approved", "Derse eklendin", `${row.trainer.name} seni ${when(row.lesson)} dersine ekledi.`, `/rezervasyonlar/${row.booking.id}`);
  if (!row.member.emailNotifications) return;
  await sendEmail({
    to: row.member.email,
    subject: `Derse eklendin · ${formatDayLong(row.lesson.startsAt)} ${formatTime(row.lesson.startsAt)}`,
    heading: "Yerin ayrıldı, görüşmek üzere.",
    paragraphs: [
      `Merhaba ${row.member.name.split(" ")[0]}, ${row.trainer.name} seni ${when(row.lesson)} reformer dersine ekledi. Rezervasyonun onaylı; ayrıca bir şey yapmana gerek yok.`,
      `Gelemeyeceksen derse ${studio.cancellationHours} saat kalana kadar uygulamadan iptal edebilirsin.`,
    ],
    details: lessonDetails(row),
    action: { label: "Rezervasyonu gör", href: `/rezervasyonlar/${row.booking.id}` },
    calendar: { ics: calendarFor(row) },
  });
}

export async function notifyBookingCancelled(bookingId: string) {
  const row = await loadBooking(bookingId);
  if (!row) return;
  // Only approved bookings carry a decision date; without one the member withdrew a pending request.
  const wasApproved = row.booking.decidedAt !== null;
  const title = wasApproved ? "Bir rezervasyon iptal edildi" : "Bir talep geri çekildi";
  await inApp(row.trainer.id, "cancelled", title, `${row.member.name} · ${when(row.lesson)}`, `/egitmen-paneli/dersler/${row.lesson.id}`);
  if (row.trainer.emailNotifications) await sendEmail({
    to: row.trainer.email,
    subject: `${wasApproved ? "İptal" : "Talep geri çekildi"} · ${row.member.name} · ${formatDayLong(row.lesson.startsAt)} ${formatTime(row.lesson.startsAt)}`,
    heading: wasApproved ? "Bir rezervasyon iptal edildi." : "Bir talep geri çekildi.",
    paragraphs: [wasApproved
      ? `${row.member.name}, ${when(row.lesson)} dersindeki onaylı yerini iptal etti. Bu yer artık diğer üyelere açık.`
      : `${row.member.name}, ${when(row.lesson)} dersi için gönderdiği talebi onayını beklemeden geri çekti. Senin bir şey yapmana gerek yok.`],
    details: lessonDetails(row).slice(0, 3),
    action: { label: "Ders listesini gör", href: `/egitmen-paneli/dersler/${row.lesson.id}` },
  });
}

export async function notifyLessonCancelled(lessonId: string, bookingIds: string[]) {
  for (const bookingId of bookingIds) {
    const row = await loadBooking(bookingId);
    if (!row || row.lesson.id !== lessonId) continue;
    await inApp(row.member.id, "cancelled", "Dersin iptal edildi", `${lessonTitle(row.lesson)} · ${when(row.lesson)}`, "/dersler");
    if (row.member.emailNotifications) await sendEmail({
      to: row.member.email, subject: `Ders iptali · ${formatDayLong(row.lesson.startsAt)} ${formatTime(row.lesson.startsAt)}`,
      heading: "Dersin iptal edildi.",
      paragraphs: [`${row.trainer.name}, ${when(row.lesson)} dersini iptal etmek zorunda kaldı. Rezervasyonun kaldırıldı.`, "Programdan başka bir saat seçebilirsin."],
      details: lessonDetails(row), action: { label: "Ders programına git", href: "/dersler" },
      // Removes the event the member may have added from the approval e-mail.
      calendar: row.booking.decidedAt ? { ics: calendarFor(row, true), cancelled: true } : undefined,
    });
  }
}

/** Day-before reminder for a confirmed seat (sent once by the daily job). */
export async function notifyLessonReminder(bookingId: string) {
  const row = await loadBooking(bookingId);
  if (!row || row.booking.status !== "approved" || row.lesson.status !== "published") return;
  await inApp(row.member.id, "info", "Yarın dersin var", `${lessonTitle(row.lesson)} · ${when(row.lesson)}`, `/rezervasyonlar/${row.booking.id}`);
  if (!row.member.emailNotifications) return;
  await sendEmail({
    to: row.member.email,
    subject: `Yarın ${formatTime(row.lesson.startsAt)} · reformer dersin`,
    timely: true,
    heading: "Yarın görüşüyoruz.",
    paragraphs: [
      `Merhaba ${row.member.name.split(" ")[0]}, ${when(row.lesson)} reformer dersin için yerin hazır. Rahat kıyafet ve kaymaz çorabını unutma; birkaç dakika erken gelirsen aletini birlikte ayarlarız.`,
      `Gelemeyecek misin? Derse ${studio.cancellationHours} saat kalana kadar uygulamadan iptal edebilirsin; yerin bekleyen bir üyeye açılır.`,
    ],
    details: lessonDetails(row),
    action: { label: "Rezervasyonu gör", href: `/rezervasyonlar/${row.booking.id}` },
  });
}

const lessonWhen = (startsAt: Date) => `${formatDayLong(startsAt)}, ${formatTime(startsAt)}`;

/**
 * A seat freed up (cancellation, rejection, bigger class, deleted account): everyone on the waitlist
 * hears about it at once and the first request wins, guarded by the booking lock. Members told in
 * the last 30 minutes are skipped so a busy afternoon does not flood them.
 */
export async function notifySeatOpened(lessonId: string) {
  const db = await getDb();
  const [lesson] = await db.select({ id: lessons.id, startsAt: lessons.startsAt, status: lessons.status, capacity: lessons.capacity,
    taken: sql<number>`(select count(*)::int from bookings b where b.lesson_id = "lessons"."id" and b.status in ('pending', 'approved'))` })
    .from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lesson || lesson.status !== "published" || lesson.startsAt.getTime() <= Date.now() || lesson.taken >= lesson.capacity) return;

  const now = new Date();
  const waiting = await db.update(waitlist).set({ notifiedAt: now })
    .where(and(eq(waitlist.lessonId, lessonId), or(isNull(waitlist.notifiedAt), lt(waitlist.notifiedAt, new Date(now.getTime() - 30 * 60_000)))))
    .returning({ memberId: waitlist.memberId });
  if (!waiting.length) return;
  const people = await db.select({ id: users.id, name: users.name, email: users.email, emailNotifications: users.emailNotifications }).from(users).where(inArray(users.id, waiting.map((row) => row.memberId)));
  const when = lessonWhen(lesson.startsAt);
  for (const person of people) {
    await inApp(person.id, "info", "Beklediğin derste yer açıldı", `${when} · İlk talep gönderen yeri alır.`, `/dersler/${lesson.id}`);
    if (person.emailNotifications) await sendEmail({
      to: person.email, subject: `Yer açıldı · ${when}`,
      heading: "Beklediğin derste yer açıldı.",
      paragraphs: [`Merhaba ${person.name.split(" ")[0]}, bekleme listesinde olduğun ${when} reformer dersinde yer açıldı. Yer, ilk talep gönderen üyeye ayrılır.`],
      action: { label: "Hemen talep gönder", href: `/dersler/${lesson.id}` },
      timely: true,
    });
  }
}

/** Level or duration of a booked class changed: tell everyone holding a seat. */
export async function notifyLessonChanged(lessonId: string, changes: string[]) {
  if (!changes.length) return;
  const db = await getDb();
  const rows = await db.select({ memberId: bookings.memberId, bookingId: bookings.id, startsAt: lessons.startsAt }).from(bookings).innerJoin(lessons, eq(lessons.id, bookings.lessonId))
    .where(and(eq(bookings.lessonId, lessonId), inArray(bookings.status, ["pending", "approved"])));
  for (const row of rows) {
    await inApp(row.memberId, "info", "Dersinde değişiklik var", `${lessonWhen(row.startsAt)} · ${changes.join(", ")}`, `/rezervasyonlar/${row.bookingId}`);
  }
}

/** A member deleted their account: the trainer learns that the seat is free again. */
/** The member's data is gone, so the trainer is told without their name. */
export async function notifyMemberLeft(seat: { trainerId: string; lessonId: string; startsAt: Date }) {
  const db = await getDb();
  const [trainerRow] = await db.select({ email: users.email, emailNotifications: users.emailNotifications }).from(users).where(eq(users.id, seat.trainerId)).limit(1);
  if (!trainerRow) return;
  const when = lessonWhen(seat.startsAt);
  await inApp(seat.trainerId, "cancelled", "Bir üye hesabını sildi", `${when} — yer boşaldı`, `/egitmen-paneli/dersler/${seat.lessonId}`);
  if (trainerRow.emailNotifications) await sendEmail({
    to: trainerRow.email, subject: `Yer boşaldı · ${when}`,
    heading: "Bir üye hesabını sildi.",
    paragraphs: [`Bir üye hesabını kapattı; ${when} dersindeki yeri boşaldı. Bekleme listesindekilere haber verildi.`],
    action: { label: "Ders listesini gör", href: `/egitmen-paneli/dersler/${seat.lessonId}` },
  });
}

export async function sendEmailChangeLink(person: { name: string; newEmail: string }, link: string) {
  await sendEmail({
    to: person.newEmail, subject: "E-posta adresini onayla",
    heading: "Yeni e-posta adresini onayla.",
    paragraphs: [`Merhaba ${person.name.split(" ")[0]}, ${studio.name} hesabının e-posta adresini bu adresle değiştirmek istedin. Onaylamak için aşağıdaki bağlantıyı aç; bağlantı 1 saat geçerli.`, "Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; hesabın değişmez."],
    action: { label: "E-postamı onayla", href: link },
    sensitive: true,
  });
}

export async function sendEmailChangedNotice(person: { name: string; oldEmail: string; newEmail: string }) {
  await sendEmail({
    to: person.oldEmail, subject: "Hesabının e-posta adresi değişti",
    heading: "E-posta adresin değişti.",
    paragraphs: [`Merhaba ${person.name.split(" ")[0]}, ${studio.name} hesabının giriş e-postası ${person.newEmail} olarak değiştirildi.`, "Bu değişikliği sen yapmadıysan hemen stüdyoyla iletişime geç."],
  });
}

export async function sendWelcomeEmail(user: { name: string; email: string; role: "member" | "trainer" }) {
  await sendEmail({
    to: user.email, subject: `${studio.name} hesabın hazır`,
    heading: `Hoş geldin, ${user.name.split(" ")[0]}.`,
    paragraphs: user.role === "trainer"
      ? ["Eğitmen hesabın açıldı. Panelinden yeni ders saatleri oluşturabilir, gelen talepleri onaylayabilirsin."]
      : [`${studio.name} hesabın açıldı. Ders programından sana uygun reformer dersini seçip yerini ayırabilirsin.`],
    action: user.role === "trainer" ? { label: "Eğitmen paneline git", href: "/egitmen-paneli" } : { label: "Ders programını gör", href: "/dersler" },
  });
}

export async function sendPasswordResetEmail(user: { name: string; email: string }, link: string) {
  await sendEmail({
    to: user.email, subject: "Şifre yenileme bağlantın",
    heading: "Şifreni yenile.",
    paragraphs: [`Merhaba ${user.name.split(" ")[0]}, şifreni yenilemek için aşağıdaki bağlantıyı kullan. Bağlantı 1 saat geçerli ve yalnızca bir kez kullanılabilir.`, "Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez."],
    action: { label: "Yeni şifre belirle", href: link },
    sensitive: true,
  });
}

export async function sendGoogleLinkedNotice(user: { name: string; email: string }) {
  await sendEmail({
    to: user.email, subject: "Hesabına Google ile giriş bağlandı",
    heading: "Google ile giriş açıldı.",
    paragraphs: [
      `Merhaba ${user.name.split(" ")[0]}, ${studio.name} hesabına artık Google hesabınla giriş yapıyorsun.`,
      "Güvenliğin için eski şifren devre dışı bırakıldı ve diğer cihazlardaki oturumlar kapatıldı. İstersen profil ayarlarından yeni bir şifre belirleyebilirsin.",
      "Bunu sen yapmadıysan hemen stüdyoyla iletişime geç.",
    ],
    action: { label: "Profil ayarları", href: "/profil/ayarlar" },
  });
}
