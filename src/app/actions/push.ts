"use server";

import { and, asc, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { apnsTokens, pushSubscriptions } from "@/db/schema";
import { currentSessionId } from "@/lib/auth/session";
import { getCurrentUser, requireUser } from "@/lib/dal";
import { sendPush } from "@/lib/push";

// The server later POSTs to the endpoint, so only the browsers' own push services are accepted.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^web\.push\.apple\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];
const MAX_DEVICES = 10;

const subscriptionSchema = z.object({
  endpoint: z.string().max(1000).refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && PUSH_HOSTS.some((host) => host.test(url.hostname));
    } catch {
      return false;
    }
  }),
  keys: z.object({ p256dh: z.string().min(16).max(200), auth: z.string().min(8).max(100) }),
});

export async function savePushSubscription(input: unknown): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { endpoint, keys } = parsed.data;

  const db = await getDb();
  const sessionId = await currentSessionId();
  // A device that signs in with another account now belongs to that account (and that sign-in).
  await db.insert(pushSubscriptions).values({ userId: user.id, sessionId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: user.id, sessionId, p256dh: keys.p256dh, auth: keys.auth } });

  const devices = await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id)).orderBy(asc(pushSubscriptions.createdAt));
  if (devices.length > MAX_DEVICES) {
    const keep = devices.slice(-MAX_DEVICES).map((device) => device.id);
    await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, user.id), notInArray(pushSubscriptions.id, keep)));
  }
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const user = await requireUser();
  if (typeof endpoint !== "string" || endpoint.length > 1000) return;
  await (await getDb()).delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, user.id), eq(pushSubscriptions.endpoint, endpoint)));
}

/**
 * The iOS app reports its Apple push token (hex) for the signed-in account. Guests are ignored
 * quietly, because the app calls this on every launch, signed in or not.
 */
export async function saveNativePushToken(token: unknown): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  const parsed = z.string().regex(/^[0-9a-f]{64,200}$/i).safeParse(token);
  if (!user || !parsed.success) return { ok: false };

  const db = await getDb();
  const sessionId = await currentSessionId();
  // A phone that signs in with another account now belongs to that account (and that sign-in).
  await db.insert(apnsTokens).values({ userId: user.id, sessionId, token: parsed.data.toLowerCase() })
    .onConflictDoUpdate({ target: apnsTokens.token, set: { userId: user.id, sessionId } });

  const devices = await db.select({ id: apnsTokens.id }).from(apnsTokens).where(eq(apnsTokens.userId, user.id)).orderBy(asc(apnsTokens.createdAt));
  if (devices.length > MAX_DEVICES) {
    const keep = devices.slice(-MAX_DEVICES).map((device) => device.id);
    await db.delete(apnsTokens).where(and(eq(apnsTokens.userId, user.id), notInArray(apnsTokens.id, keep)));
  }
  return { ok: true };
}

export async function sendTestPush(): Promise<void> {
  const user = await requireUser();
  await sendPush(user.id, { title: "Bildirimler açık", body: "Rezervasyonunla ilgili gelişmeler artık bu cihaza da gelecek.", url: "/bildirimler", tag: "test" });
}
