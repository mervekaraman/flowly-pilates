import "server-only";
import { eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { sendApns } from "@/lib/apns";

// Web Push: free notifications to phones and desktops that allowed them. Keys come from the
// environment (`VAPID_*`); without them the feature is simply switched off.

export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY || null;

let configured: boolean | undefined;
function ready() {
  if (configured !== undefined) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "";
  // Apple rejects the whole request (403 BadJwtToken) unless the contact is a real mailto:/https: address.
  const validSubject = /^(mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}|https:\/\/\S+)$/i.test(subject) && !/\.(test|local|localhost|invalid|example)$/i.test(subject);
  configured = Boolean(publicKey && privateKey && validSubject);
  if (configured) webpush.setVapidDetails(subject, publicKey!, privateKey!);
  else if (publicKey) console.warn("[push] VAPID_SUBJECT gerçek bir e-posta (mailto:) ya da https adresi olmalı; telefon bildirimleri kapalı.");
  return configured;
}

export type PushMessage = { title: string; body: string; url?: string | null; tag?: string };

/** Sends to every device of the user: browsers (Web Push) and iPhones running the Flowly app (APNs). */
export async function sendPush(userId: string, message: PushMessage) {
  await Promise.all([sendWebPush(userId, message), sendApns(userId, message)]);
}

/** Subscriptions the push service has dropped are removed. */
async function sendWebPush(userId: string, message: PushMessage) {
  if (!ready()) return;
  const db = await getDb();
  const devices = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  if (!devices.length) return;

  const payload = JSON.stringify({ title: message.title, body: message.body, url: message.url ?? "/bildirimler", tag: message.tag });
  const gone: string[] = [];
  await Promise.all(devices.map(async (device) => {
    try {
      await webpush.sendNotification({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } }, payload, { TTL: 60 * 60 * 24, urgency: "high" });
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) gone.push(device.id);
      else console.error("[push] gönderilemedi", status ?? error, (error as { body?: string }).body ?? "");
    }
  }));
  if (gone.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
}
