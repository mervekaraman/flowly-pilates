import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Runs the real migrations on an in-memory Postgres and checks the rules the database must enforce.
async function migratedDb() {
  const db = new PGlite();
  const dir = new URL("../drizzle/", import.meta.url);
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()) {
    for (const statement of readFileSync(new URL(file, dir), "utf8").split("--> statement-breakpoint")) {
      if (statement.trim()) await db.exec(statement);
    }
  }
  const { rows: [trainer] } = await db.query(`insert into users (name, email, password_hash, role) values ('Eğitmen', 'e@test', 'x', 'trainer') returning id`);
  return { db, trainerId: trainer.id };
}

const addLesson = (db, trainerId, start, end, status = "published") => db.query(
  `insert into lessons (trainer_id, starts_at, ends_at, duration_min, capacity, status) values ($1, $2, $3, 50, 4, $4)`,
  [trainerId, start, end, status],
);

test("aynı anda kaydedilen iki ders stüdyoda çakışamaz; veritabanı birini reddeder", async () => {
  const { db, trainerId } = await migratedDb();
  const results = await Promise.allSettled([
    addLesson(db, trainerId, "2026-10-07T10:00:00+03:00", "2026-10-07T10:50:00+03:00"),
    addLesson(db, trainerId, "2026-10-07T10:00:00+03:00", "2026-10-07T10:50:00+03:00"),
    addLesson(db, trainerId, "2026-10-07T10:30:00+03:00", "2026-10-07T11:20:00+03:00"),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  for (const result of results.filter((item) => item.status === "rejected")) assert.equal(result.reason.code, "23P01");
  await db.close();
});

test("arka arkaya dersler ve iptal edilen dersin saati serbesttir", async () => {
  const { db, trainerId } = await migratedDb();
  await addLesson(db, trainerId, "2026-10-07T10:00:00+03:00", "2026-10-07T10:50:00+03:00", "cancelled");
  await addLesson(db, trainerId, "2026-10-07T10:00:00+03:00", "2026-10-07T10:50:00+03:00");
  await addLesson(db, trainerId, "2026-10-07T11:00:00+03:00", "2026-10-07T11:50:00+03:00");
  await assert.rejects(addLesson(db, trainerId, "2026-10-07T12:00:00+03:00", "2026-10-07T11:00:00+03:00"), { code: "23514" }, "bitiş başlangıçtan önce olamaz");
  await db.close();
});

test("efor puanı yalnızca 1–10 arasında olabilir; katılım geldi/gelmedi", async () => {
  const { db, trainerId } = await migratedDb();
  const { rows: [member] } = await db.query(`insert into users (name, email, password_hash, role) values ('Üye', 'u@test', 'x', 'member') returning id`);
  const { rows: [lesson] } = await db.query(`insert into lessons (trainer_id, starts_at, ends_at, duration_min, capacity) values ($1, '2026-10-07T10:00:00+03:00', '2026-10-07T10:50:00+03:00', 50, 4) returning id`, [trainerId]);
  const { rows: [booking] } = await db.query(`insert into bookings (lesson_id, member_id, status) values ($1, $2, 'approved') returning id`, [lesson.id, member.id]);
  await db.query(`update bookings set effort = 7, attendance = 'attended' where id = $1`, [booking.id]);
  await assert.rejects(db.query(`update bookings set effort = 11 where id = $1`, [booking.id]), { code: "23514" });
  await assert.rejects(db.query(`update bookings set effort = 0 where id = $1`, [booking.id]), { code: "23514" });
  await assert.rejects(db.query(`update bookings set attendance = 'late' where id = $1`, [booking.id]), { code: "22P02" });
  await db.close();
});

test("bekleme listesinde bir üye bir derste yalnızca bir kez yer alır", async () => {
  const { db, trainerId } = await migratedDb();
  const { rows: [member] } = await db.query(`insert into users (name, email, password_hash, role) values ('Üye', 'w@test', 'x', 'member') returning id`);
  const { rows: [lesson] } = await db.query(`insert into lessons (trainer_id, starts_at, ends_at, duration_min, capacity) values ($1, '2026-10-07T10:00:00+03:00', '2026-10-07T10:50:00+03:00', 50, 4) returning id`, [trainerId]);
  await db.query(`insert into waitlist (lesson_id, member_id) values ($1, $2)`, [lesson.id, member.id]);
  await assert.rejects(db.query(`insert into waitlist (lesson_id, member_id) values ($1, $2)`, [lesson.id, member.id]), { code: "23505" });
  await db.query(`delete from users where id = $1`, [member.id]);
  const { rows } = await db.query(`select count(*)::int as n from waitlist`);
  assert.equal(rows[0].n, 0, "hesap silinince bekleme kaydı da silinmeli");
  await db.close();
});

test("giriş deneme sayacı tek komutla artar ve süre dolunca sıfırlanır", async () => {
  const { db } = await migratedDb();
  // Same statement shape as src/lib/rate-limit.ts.
  const hit = async (resetAt) => (await db.query(
    `insert into rate_limits (key, count, reset_at) values ('k', 1, $1) on conflict (key) do update set
       count = case when rate_limits.reset_at < now() then 1 else rate_limits.count + 1 end,
       reset_at = case when rate_limits.reset_at < now() then $1::timestamptz else rate_limits.reset_at end returning count`, [resetAt])).rows[0].count;
  const later = new Date(Date.now() + 60_000).toISOString();
  const counts = await Promise.all(Array.from({ length: 5 }, () => hit(later)));
  assert.deepEqual([...counts].sort(), [1, 2, 3, 4, 5]);
  await db.query(`update rate_limits set reset_at = now() - interval '1 minute'`);
  assert.equal(await hit(later), 1, "süresi dolan pencere yeniden başlamalı");
  await db.close();
});

test("Supabase veri API'sine karşı bütün tablolarda satır düzeyi güvenlik (RLS) açık", async () => {
  const { db } = await migratedDb();
  const { rows } = await db.query(`select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'`);
  assert.ok(rows.length >= 12);
  const open = rows.filter((row) => !row.relrowsecurity).map((row) => row.relname);
  assert.deepEqual(open, [], `RLS kapalı tablolar: ${open.join(", ")} — yeni tabloya migration'da ENABLE ROW LEVEL SECURITY ekleyin`);
  await db.close();
});

test("katılım durumu rezervasyon kararından ayrı ve yalnızca tanımlı değerlerdedir", async () => {
  const { db, trainerId } = await migratedDb();
  const { rows: [member] } = await db.query(`insert into users (name, email, password_hash) values ('Üye', 'u@test', 'x') returning id`);
  const { rows: [lesson] } = await db.query(`insert into lessons (trainer_id, starts_at, ends_at, duration_min, capacity) values ($1, '2026-10-01T10:00:00+03:00', '2026-10-01T10:50:00+03:00', 50, 4) returning id`, [trainerId]);
  const { rows: [booking] } = await db.query(`insert into bookings (lesson_id, member_id, status, attendance) values ($1, $2, 'approved', 'attended') returning status, attendance`, [lesson.id, member.id]);
  assert.deepEqual(booking, { status: "approved", attendance: "attended" });
  await assert.rejects(db.query(`update bookings set attendance = 'unknown' where lesson_id = $1`, [lesson.id]), { code: "22P02" });
  await db.close();
});

test("sabit saat: üye bir gün ve saat için tek açık talep tutar; biten saat yeniden istenebilir", async () => {
  const { db, trainerId } = await migratedDb();
  const { rows: [member] } = await db.query(`insert into users (name, email, password_hash, role) values ('Üye', 'f@test', 'x', 'member') returning id`);
  const { rows: [slot] } = await db.query(`insert into fixed_slots (member_id, weekday, start_time) values ($1, 2, '08:00') returning id, status`, [member.id]);
  assert.equal(slot.status, "pending");
  await assert.rejects(db.query(`insert into fixed_slots (member_id, weekday, start_time) values ($1, 2, '08:00')`, [member.id]), { code: "23505" });
  await db.query(`insert into fixed_slots (member_id, weekday, start_time) values ($1, 5, '08:00')`, [member.id]);
  await db.query(`update fixed_slots set status = 'ended' where id = $1`, [slot.id]);
  await db.query(`insert into fixed_slots (member_id, weekday, start_time) values ($1, 2, '08:00')`, [member.id]);
  await assert.rejects(db.query(`insert into fixed_slots (member_id, weekday, start_time) values ($1, 7, '08:00')`, [member.id]), { code: "23514" }, "pazar olamaz");
  await assert.rejects(db.query(`insert into fixed_slots (member_id, weekday, start_time) values ($1, 3, '08:30')`, [member.id]), { code: "23514" }, "saat başı olmalı");

  // A booking made for the fixed time survives the time itself being removed.
  const { rows: [lesson] } = await db.query(`insert into lessons (trainer_id, starts_at, ends_at, duration_min, capacity) values ($1, '2026-11-03T08:00:00+03:00', '2026-11-03T08:50:00+03:00', 50, 4) returning id`, [trainerId]);
  await db.query(`insert into bookings (lesson_id, member_id, status, fixed_slot_id) values ($1, $2, 'approved', $3)`, [lesson.id, member.id, slot.id]);
  await db.query(`delete from fixed_slots where id = $1`, [slot.id]);
  const { rows: [booking] } = await db.query(`select status, fixed_slot_id from bookings where lesson_id = $1`, [lesson.id]);
  assert.deepEqual(booking, { status: "approved", fixed_slot_id: null });
  await db.query(`delete from users where id = $1`, [member.id]);
  const { rows } = await db.query(`select count(*)::int as n from fixed_slots`);
  assert.equal(rows[0].n, 0, "hesap silinince sabit saatler de silinmeli");
  await db.close();
});

test("dersi olan eğitmen satırı silinemez; bu yüzden eğitmen hesabı silinirken kişisel veriler anonimleşir", async () => {
  const { db, trainerId } = await migratedDb();
  await addLesson(db, trainerId, "2026-10-07T10:00:00+03:00", "2026-10-07T10:50:00+03:00");
  await assert.rejects(db.query(`delete from users where id = $1`, [trainerId]), { code: "23001" }, "geçmiş dersler eğitmene bağlı kalmalı");
  await db.query(`update users set name = 'Eski eğitmen', email = 'silinmis-' || id || '@flowly.invalid', deleted_at = now() where id = $1`, [trainerId]);
  const { rows: [row] } = await db.query(`select name, deleted_at is not null as deleted, (select count(*)::int from lessons where trainer_id = $1) as lessons from users where id = $1`, [trainerId]);
  assert.deepEqual(row, { name: "Eski eğitmen", deleted: true, lessons: 1 });
  await db.close();
});

test("uygulama bildirim anahtarı tekildir ve çıkış yapılınca (oturum silinince) silinir", async () => {
  const { db } = await migratedDb();
  const { rows: [member] } = await db.query(`insert into users (name, email, password_hash, role) values ('Üye', 'a@test', 'x', 'member') returning id`);
  await db.query(`insert into sessions (id, user_id, expires_at) values ('s1', $1, now() + interval '1 day')`, [member.id]);
  const token = "ab".repeat(32);
  await db.query(`insert into apns_tokens (user_id, session_id, token) values ($1, 's1', $2)`, [member.id, token]);
  await assert.rejects(db.query(`insert into apns_tokens (user_id, session_id, token) values ($1, 's1', $2)`, [member.id, token]), { code: "23505" });
  await db.query(`delete from sessions where id = 's1'`);
  const { rows } = await db.query(`select count(*)::int as n from apns_tokens`);
  assert.equal(rows[0].n, 0, "çıkış yapan telefona bildirim gitmemeli");
  await db.close();
});
