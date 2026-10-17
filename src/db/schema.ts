import { sql } from "drizzle-orm";
import { boolean, check, index, pgEnum, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["member", "trainer"]);
// Only reformer classes are offered for now; new types are added later with `ALTER TYPE ... ADD VALUE`.
export const lessonType = pgEnum("lesson_type", ["reformer"]);
export const lessonLevel = pgEnum("lesson_level", ["tum", "baslangic", "orta", "ileri"]);
export const lessonStatus = pgEnum("lesson_status", ["published", "cancelled"]);
export const bookingStatus = pgEnum("booking_status", ["pending", "approved", "rejected", "cancelled"]);
export const attendanceStatus = pgEnum("attendance_status", ["attended", "no_show"]);
export const emailStatus = pgEnum("email_status", ["sent", "logged", "failed"]);
export const notificationKind = pgEnum("notification_kind", ["request", "approved", "rejected", "cancelled", "review", "info"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Always stored lower-cased; the unique index is the single source of truth for duplicates.
  email: text("email").notNull(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  // False for accounts opened with Google: the stored hash is random until the member sets a password.
  passwordSet: boolean("password_set").notNull().default(true),
  /** Google account id ("sub"), set once the member signs in with Google. */
  googleSub: text("google_sub"),
  role: userRole("role").notNull().default("member"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  createdAt: createdAt(),
}, (table) => [uniqueIndex("users_email_unique").on(table.email), uniqueIndex("users_google_sub_unique").on(table.googleSub)]);

// Only a SHA-256 hash of the session token is stored, so a leaked table cannot be replayed as cookies.
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (table) => [index("sessions_user_idx").on(table.userId)]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// A confirmed request to change the login e-mail; the link goes to the new address.
export const emailChangeTokens = pgTable("email_change_tokens", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  newEmail: text("new_email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  trainerId: uuid("trainer_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  type: lessonType("type").notNull().default("reformer"),
  level: lessonLevel("level").notNull().default("tum"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  // Stored (not derived) so the database itself can refuse overlapping classes; see drizzle/0002.
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  durationMin: smallint("duration_min").notNull(),
  capacity: smallint("capacity").notNull(),
  note: text("note"),
  status: lessonStatus("status").notNull().default("published"),
  createdAt: createdAt(),
}, (table) => [
  index("lessons_starts_at_idx").on(table.startsAt),
  index("lessons_trainer_idx").on(table.trainerId),
  check("lessons_capacity_positive", sql`${table.capacity} > 0`),
  check("lessons_duration_positive", sql`${table.durationMin} > 0`),
  check("lessons_ends_after_start", sql`${table.endsAt} > ${table.startsAt}`),
]);

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: bookingStatus("status").notNull().default("pending"),
  attendance: attendanceStatus("attendance"),
  attendanceMarkedAt: timestamp("attendance_marked_at", { withTimezone: true }),
  memberNote: text("member_note"),
  // When the member gave explicit consent (KVKK md. 6) to share the note, which may hold health data.
  memberNoteConsentAt: timestamp("member_note_consent_at", { withTimezone: true }),
  // Member's own Spotify playlist suggestion for the class (normalised open.spotify.com link).
  playlistUrl: text("playlist_url"),
  trainerNote: text("trainer_note"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  // Member's rating of how hard the class felt (RPE, 1 = çok hafif … 10 = maksimum).
  effort: smallint("effort"),
  effortAt: timestamp("effort_at", { withTimezone: true }),
  // Set when the day-before reminder went out, so the daily job never sends it twice.
  reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // One row per member per lesson; a cancelled request is re-opened instead of duplicated.
  uniqueIndex("bookings_lesson_member_unique").on(table.lessonId, table.memberId),
  index("bookings_member_idx").on(table.memberId),
  check("bookings_effort_range", sql`${table.effort} between 1 and 10`),
]);

// Members waiting for a seat in a full class; they are told when one frees up.
export const waitlist = pgTable("waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  lessonId: uuid("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  notifiedAt: timestamp("notified_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (table) => [uniqueIndex("waitlist_lesson_member_unique").on(table.lessonId, table.memberId), index("waitlist_member_idx").on(table.memberId)]);

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  trainerId: uuid("trainer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rating: smallint("rating").notNull(),
  comment: text("comment").notNull(),
  recommendsTrainer: boolean("recommends_trainer").notNull().default(false),
  recommendsStudio: boolean("recommends_studio").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("reviews_booking_unique").on(table.bookingId),
  check("reviews_rating_range", sql`${table.rating} between 1 and 5`),
]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: notificationKind("kind").notNull().default("info"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  href: text("href"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (table) => [index("notifications_user_idx").on(table.userId, table.createdAt)]);

// Every e-mail the app produces lands here: "sent" via SMTP, or "logged" when SMTP is not configured.
// One row per device/browser that allowed Web Push notifications.
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Tied to the sign-in it was made in: signing out (or every session ending) silences the device,
  // so the next person on a shared phone never sees someone else's notifications.
  sessionId: text("session_id").references(() => sessions.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: createdAt(),
}, (table) => [uniqueIndex("push_subscriptions_endpoint_idx").on(table.endpoint), index("push_subscriptions_user_idx").on(table.userId)]);

export const emailOutbox = pgTable("email_outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  text: text("text").notNull(),
  status: emailStatus("status").notNull(),
  error: text("error"),
  retryable: boolean("retryable").notNull().default(true),
  attempts: smallint("attempts").notNull().default(1),
  createdAt: createdAt(),
});

// Shared across all server instances so login/reset protection also works on serverless deployments.
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: smallint("count").notNull().default(1),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
}, (table) => [index("rate_limits_reset_idx").on(table.resetAt)]);

export type User = typeof users.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type LessonType = (typeof lessonType.enumValues)[number];
export type LessonLevel = (typeof lessonLevel.enumValues)[number];
export type BookingStatus = (typeof bookingStatus.enumValues)[number];
export type AttendanceStatus = (typeof attendanceStatus.enumValues)[number];
export type NotificationKind = (typeof notificationKind.enumValues)[number];
