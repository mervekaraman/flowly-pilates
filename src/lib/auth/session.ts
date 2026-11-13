import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";

export const SESSION_COOKIE = "smeda_session";
// A session ends after 30 days without use; every visit pushes that back (at most one database write a day).
const SESSION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
// The cookie only carries the token; the database row decides whether it is still valid. Pages can't
// rewrite cookies, so the cookie gets the longest life browsers allow (400 days) and the row's
// sliding expiry does the real work. Signing out and password resets still delete the row at once.
const COOKIE_DAYS = 400;
const sessionEnd = () => new Date(Date.now() + SESSION_DAYS * DAY_MS);

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

export type SessionUser = { id: string; name: string; email: string; phone: string | null; role: "member" | "trainer"; avatarUrl: string | null; emailNotifications: boolean };

export async function createSession(userId: string) {
  const token = newToken();
  const db = await getDb();
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt: sessionEnd() });
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: COOKIE_DAYS * 24 * 60 * 60 });
}

export async function readSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const id = hashToken(token);
  const [row] = await db.select({ expiresAt: sessions.expiresAt, id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role, avatarUrl: users.avatarUrl, emailNotifications: users.emailNotifications })
    .from(sessions).innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  const { expiresAt, ...user } = row;
  // Extended at most once a day, so an active member never has to sign in again.
  if (expiresAt.getTime() < Date.now() + (SESSION_DAYS - 1) * DAY_MS) {
    await db.update(sessions).set({ expiresAt: sessionEnd() }).where(eq(sessions.id, id));
  }
  return user;
}

/** Hash of the current session token (the sessions.id), if signed in. */
export async function currentSessionId() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? hashToken(token) : null;
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await (await getDb()).delete(sessions).where(eq(sessions.id, hashToken(token)));
  cookieStore.delete(SESSION_COOKIE);
}

/** Signs a user out everywhere, e.g. after a password reset. */
export async function deleteUserSessions(userId: string) {
  await (await getDb()).delete(sessions).where(eq(sessions.userId, userId));
}
