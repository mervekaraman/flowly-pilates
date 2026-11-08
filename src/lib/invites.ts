import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { hashToken, newToken } from "@/lib/auth/session";
import { appUrl } from "@/lib/mail";

/**
 * Accounts the studio opens for its members (scripts/import-members.ts). They start without a password;
 * the member gets a one-time link, chooses a password and accepts the privacy notice themselves.
 * The link reuses the password-reset token table (stored as a SHA-256 hash, single use) with a longer life.
 */
export const INVITE_DAYS = 7;

/** Opened by the studio and never used: no password chosen and no Google sign-in linked. */
export const isPendingInvite = (user: { passwordSet: boolean; googleSub: string | null }) => !user.passwordSet && !user.googleSub;

/** A fresh invite link for the account; any earlier unused link stops working. */
export async function createInviteLink(userId: string) {
  const db = await getDb();
  const token = newToken();
  await db.delete(passwordResetTokens).where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
  await db.insert(passwordResetTokens).values({ id: hashToken(token), userId, expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000) });
  return `${appUrl()}/hesap-etkinlestir?token=${token}`;
}

/** The invited member behind a valid, unused link, or null (expired, used, or the account is already active). */
export async function findInvite(token: string) {
  if (token.length < 20) return null;
  const db = await getDb();
  const [row] = await db.select({ userId: users.id, name: users.name, email: users.email, passwordSet: users.passwordSet, googleSub: users.googleSub })
    .from(passwordResetTokens).innerJoin(users, eq(users.id, passwordResetTokens.userId))
    .where(and(eq(passwordResetTokens.id, hashToken(token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date()))).limit(1);
  return row && isPendingInvite(row) ? row : null;
}
