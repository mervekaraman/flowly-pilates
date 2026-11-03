import "server-only";
import { connect } from "node:http2";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { apnsTokens } from "@/db/schema";
import { apnsJwt, apnsPayload } from "@/lib/apns-jwt";

// Notifications to the Flowly iOS app through Apple's push service. Needs APNS_KEY (the .p8 file's
// text), APNS_KEY_ID and APNS_TEAM_ID from the Apple Developer account; without them it is off.

const HOSTS = { production: "https://api.push.apple.com", sandbox: "https://api.sandbox.push.apple.com" } as const;
const bundleId = () => process.env.APNS_BUNDLE_ID || "com.mervekaraman.flowly";

export const isApnsConfigured = () => Boolean(process.env.APNS_KEY && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID);

// Apple wants the same token reused for up to an hour and refuses ones refreshed too often.
let cached: { jwt: string; at: number } | undefined;
function authToken() {
  if (!cached || Date.now() - cached.at > 50 * 60 * 1000) {
    cached = { jwt: apnsJwt({ key: process.env.APNS_KEY!, keyId: process.env.APNS_KEY_ID!, teamId: process.env.APNS_TEAM_ID! }), at: Date.now() };
  }
  return cached.jwt;
}

type Result = { status: number; reason?: string };

function post(host: string, deviceToken: string, payload: string): Promise<Result> {
  return new Promise((resolve) => {
    const client = connect(host);
    client.on("error", (error) => resolve({ status: 0, reason: error.message }));
    const request = client.request({
      ":method": "POST", ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${authToken()}`, "apns-topic": bundleId(), "apns-push-type": "alert", "apns-priority": "10",
      "apns-expiration": String(Math.floor(Date.now() / 1000) + 24 * 60 * 60), "content-type": "application/json",
    });
    let status = 0;
    let body = "";
    request.setEncoding("utf8");
    request.on("response", (headers) => { status = Number(headers[":status"]); });
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      client.close();
      let reason: string | undefined;
      try { reason = body ? (JSON.parse(body) as { reason?: string }).reason : undefined; } catch { reason = undefined; }
      resolve({ status, reason });
    });
    request.on("error", (error) => { client.close(); resolve({ status: 0, reason: error.message }); });
    request.setTimeout(10_000, () => request.close());
    request.end(payload);
  });
}

// Tokens Apple says are no longer valid for this app; they are removed.
const GONE = new Set(["Unregistered", "BadDeviceToken", "DeviceTokenNotForTopic"]);

/** Sends to every iPhone of the user. Tokens from Xcode debug builds belong to Apple's sandbox. */
export async function sendApns(userId: string, message: { title: string; body: string; url?: string | null; tag?: string }) {
  if (!isApnsConfigured()) return;
  const db = await getDb();
  const devices = await db.select().from(apnsTokens).where(eq(apnsTokens.userId, userId));
  if (!devices.length) return;

  const payload = apnsPayload(message);
  const gone: string[] = [];
  const sandboxed: string[] = [];
  await Promise.all(devices.map(async (device) => {
    let result = await post(device.sandbox ? HOSTS.sandbox : HOSTS.production, device.token, payload);
    // A token Apple's live service does not know may come from a debug build: try the sandbox once.
    if (!device.sandbox && result.reason === "BadDeviceToken") {
      result = await post(HOSTS.sandbox, device.token, payload);
      if (result.status === 200) sandboxed.push(device.id);
    }
    if (result.status === 200) return;
    if (result.status === 410 || GONE.has(result.reason ?? "")) gone.push(device.id);
    else console.error("[apns] gönderilemedi", result.status, result.reason ?? "");
  }));
  if (gone.length) await db.delete(apnsTokens).where(inArray(apnsTokens.id, gone));
  if (sandboxed.length) await db.update(apnsTokens).set({ sandbox: true }).where(inArray(apnsTokens.id, sandboxed));
}
