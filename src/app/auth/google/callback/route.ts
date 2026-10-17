import { randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getDb } from "@/db";
import { emailChangeTokens, passwordResetTokens, pushSubscriptions, sessions, users } from "@/db/schema";
import { exchangeGoogleCode, GOOGLE_ATTEMPT_COOKIE, GOOGLE_PENDING_COOKIE, sealPendingSignup } from "@/lib/auth/google";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { homeFor } from "@/lib/dal";
import { sendGoogleLinkedNotice } from "@/lib/notify";
import { maskEmail, safeNext } from "@/lib/privacy";

type Attempt = { state: string; verifier: string; nonce: string; next: string | null };

const sameText = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Google sends the member back here. Known Google account → signed in; same verified e-mail as an
// existing account → linked and signed in; otherwise → a short form for phone and consent.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const cookieStore = await cookies();
  const raw = cookieStore.get(GOOGLE_ATTEMPT_COOKIE)?.value;
  cookieStore.delete({ name: GOOGLE_ATTEMPT_COOKIE, path: "/auth/google" });

  let attempt: Attempt | null = null;
  try {
    attempt = raw ? JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Attempt : null;
  } catch {
    attempt = null;
  }
  if (params.get("error")) redirect("/giris?google=iptal");
  const code = params.get("code");
  const state = params.get("state");
  if (!attempt || !code || !state || !sameText(state, attempt.state)) redirect("/giris?google=hata");

  let profile;
  try {
    profile = await exchangeGoogleCode(code, attempt.verifier, attempt.nonce);
  } catch (error) {
    console.error(`[google] giriş tamamlanamadı: ${error instanceof Error ? error.message : String(error)}`);
    redirect("/giris?google=hata");
  }
  const next = safeNext(attempt.next);

  const db = await getDb();
  const [byGoogle] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.googleSub, profile.sub)).limit(1);
  let user = byGoogle;
  if (!user) {
    const [byEmail] = await db.select({ id: users.id, role: users.role, name: users.name, googleSub: users.googleSub }).from(users).where(eq(users.email, profile.email)).limit(1);
    if (byEmail && byEmail.googleSub && byEmail.googleSub !== profile.sub) {
      console.warn(`[google] ${maskEmail(profile.email)} başka bir Google hesabına bağlı`);
      redirect("/giris?google=baska");
    }
    if (byEmail) {
      // Only Google-owned addresses (gmail.com, Workspace) are linked automatically; others could
      // be a Google account someone opened with an address that is not really theirs.
      if (!profile.authoritative) redirect("/giris?google=bagla");
      // Someone may have opened this account with the owner's address before they ever came, so
      // linking takes the account over completely: the old password, sessions, pending links and
      // push devices stop working, and the owner is told.
      await db.transaction(async (tx) => {
        await tx.update(users).set({ googleSub: profile.sub, passwordSet: false, passwordHash: await hashPassword(randomBytes(32).toString("base64url")) }).where(eq(users.id, byEmail.id));
        await tx.delete(sessions).where(eq(sessions.userId, byEmail.id));
        await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, byEmail.id));
        await tx.delete(emailChangeTokens).where(eq(emailChangeTokens.userId, byEmail.id));
        await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, byEmail.id));
      });
      after(() => sendGoogleLinkedNotice({ name: byEmail.name, email: profile.email }));
      user = { id: byEmail.id, role: byEmail.role };
    }
  }

  if (user) {
    await createSession(user.id);
    redirect(next ?? homeFor(user));
  }

  cookieStore.set(GOOGLE_PENDING_COOKIE, sealPendingSignup(profile, next), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 15 * 60,
  });
  redirect("/uye-ol/google");
}
