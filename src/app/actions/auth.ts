"use server";

import { timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, deleteSession, deleteUserSessions, hashToken, newToken } from "@/lib/auth/session";
import { homeFor, safeNext } from "@/lib/dal";
import { fieldErrors, keepValues, normalizePhone, type FormState } from "@/lib/forms";
import { appUrl } from "@/lib/mail";
import { sendPasswordResetEmail, sendWelcomeEmail } from "@/lib/notify";
import { clearRateLimit, hitRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

const email = z.string().trim().toLowerCase().pipe(z.email({ error: "Geçerli bir e-posta adresi gir." }));
const newPassword = z.string().min(8, { error: "Şifre en az 8 karakter olmalı." }).max(128, { error: "Şifre en fazla 128 karakter olabilir." });

const signupSchema = z.object({
  name: z.string().trim().min(2, { error: "Adını ve soyadını yaz." }).max(80, { error: "Ad soyad en fazla 80 karakter olabilir." }),
  email,
  phone: z.string().transform((value, ctx) => {
    const phone = normalizePhone(value);
    if (!phone) ctx.addIssue({ code: "custom", message: "Geçerli bir cep telefonu numarası gir (ör. 0532 123 45 67)." });
    return phone ?? "";
  }),
  password: newPassword,
  terms: z.literal("on", { error: "Devam etmek için koşulları kabul etmelisin." }),
  inviteCode: z.string().trim().max(64).optional(),
});

function inviteCodeMatches(code: string) {
  const expected = process.env.TRAINER_INVITE_CODE;
  if (!expected) return false;
  const a = Buffer.from(code.toUpperCase());
  const b = Buffer.from(expected.toUpperCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function signup(_: FormState, formData: FormData): Promise<FormState> {
  const values = keepValues(formData, ["name", "email", "phone", "inviteCode"]);
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const { name, email, phone, password, inviteCode } = parsed.data;
  // Slows down probing which e-mails are members and guessing the trainer invite code.
  const ip = await clientIp();
  if (await hitRateLimit(`signup:${ip}`, 10, 60 * 60 * 1000)) return { error: "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar dene.", values };

  let role: "member" | "trainer" = "member";
  if (inviteCode) {
    // Per IP and studio-wide per day, so the code cannot be guessed from many addresses either.
    if (await hitRateLimit(`invite:${ip}`, 5, 60 * 60 * 1000) || await hitRateLimit("invite:all", 30, 24 * 60 * 60 * 1000)) return { fieldErrors: { inviteCode: "Çok fazla deneme yapıldı. Kodu stüdyodan teyit et." }, values };
    if (!inviteCodeMatches(inviteCode)) return { fieldErrors: { inviteCode: "Davet kodu geçersiz. Kodu stüdyodan teyit et ya da alanı boş bırak." }, values };
    role = "trainer";
  }

  const db = await getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { fieldErrors: { email: "Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene." }, values };

  const [user] = await db.insert(users).values({ name, email, phone, role, passwordHash: await hashPassword(password) })
    .onConflictDoNothing({ target: users.email }).returning({ id: users.id });
  if (!user) return { fieldErrors: { email: "Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene." }, values };

  await createSession(user.id);
  after(() => sendWelcomeEmail({ name, email, role }));
  // New accounts first see the short guide; it then continues to where they were heading.
  const next = safeNext(formData.get("sonra"));
  redirect(`/rehber?ilk=1${next ? `&sonra=${encodeURIComponent(next)}` : ""}`);
}

// Compared against when the e-mail is unknown, so both paths take the same time.
const dummyHash = hashPassword("smeda-timing-guard");

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const values = keepValues(formData, ["email"]);
  const parsed = z.object({ email, password: z.string().min(1, { error: "Şifreni yaz." }) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const limitKey = `login:${parsed.data.email}`;
  // Per account (guessing one password) and per IP (trying many accounts with leaked passwords).
  const tooMany = await hitRateLimit(limitKey, 8, 15 * 60 * 1000) || await hitRateLimit(`login-ip:${await clientIp()}`, 30, 15 * 60 * 1000);
  if (tooMany) return { error: "Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar dene.", values };

  const db = await getDb();
  const [user] = await db.select({ id: users.id, role: users.role, passwordHash: users.passwordHash }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? await dummyHash);
  if (!user || !valid) return { error: "E-posta ya da şifre hatalı.", values };

  await clearRateLimit(limitKey);
  await createSession(user.id);
  redirect(safeNext(formData.get("sonra")) ?? homeFor(user));
}

export async function logout() {
  await deleteSession();
  redirect("/");
}

const RESET_MINUTES = 60;

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const values = keepValues(formData, ["email"]);
  const parsed = z.object({ email }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const done: FormState = { ok: true, message: "Bu e-postayla kayıtlı bir hesap varsa, şifre yenileme bağlantısını gönderdik. Gelen kutunu (ve gereksiz klasörünü) kontrol et." };
  if (await hitRateLimit(`reset:${parsed.data.email}`, 3, 60 * 60 * 1000)) return done;

  const db = await getDb();
  const [user] = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (user) {
    const token = newToken();
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
    await db.insert(passwordResetTokens).values({ id: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + RESET_MINUTES * 60 * 1000) });
    after(() => sendPasswordResetEmail(user, `${appUrl()}/sifre-sifirlama/yeni?token=${token}`));
  }
  return done;
}

export async function resetPassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ token: z.string().min(20), password: newPassword, confirm: z.string() })
    .refine((data) => data.password === data.confirm, { path: ["confirm"], error: "Şifreler aynı değil." })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const db = await getDb();
  const tokenId = hashToken(parsed.data.token);
  const [token] = await db.select({ userId: passwordResetTokens.userId }).from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.id, tokenId), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date()))).limit(1);
  if (!token) return { error: "Bu bağlantının süresi dolmuş ya da daha önce kullanılmış. Yeni bir bağlantı iste." };

  const passwordHash = await hashPassword(parsed.data.password);
  const applied = await db.transaction(async (tx) => {
    // Claim the token first: of two simultaneous submissions only one can mark it used.
    const claimed = await tx.update(passwordResetTokens).set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.id, tokenId), isNull(passwordResetTokens.usedAt))).returning({ id: passwordResetTokens.id });
    if (!claimed.length) return false;
    await tx.update(users).set({ passwordHash }).where(eq(users.id, token.userId));
    // Any other reset link that was requested earlier stops working too.
    await tx.delete(passwordResetTokens).where(and(eq(passwordResetTokens.userId, token.userId), isNull(passwordResetTokens.usedAt)));
    return true;
  });
  if (!applied) return { error: "Bu bağlantı az önce kullanıldı. Yeni bir bağlantı iste." };
  await deleteUserSessions(token.userId);
  await createSession(token.userId);
  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, token.userId)).limit(1);
  redirect(homeFor(user ?? { role: "member" }));
}
