// The token Apple's push service expects on every request: a JWT signed (ES256) with the .p8 key
// from the Apple Developer account. Pure (no network) so it is unit-tested.
import { createPrivateKey, sign } from "node:crypto";

const base64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

/** `key` is the .p8 file's text; "\n" escapes (as stored in env vars) are accepted. */
export function apnsJwt({ key, keyId, teamId, now = Date.now() }: { key: string; keyId: string; teamId: string; now?: number }): string {
  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = base64url(JSON.stringify({ iss: teamId, iat: Math.floor(now / 1000) }));
  const privateKey = createPrivateKey(key.replace(/\\n/g, "\n").trim());
  // JWT wants the raw r||s form of the ECDSA signature, not DER.
  const signature = sign("sha256", Buffer.from(`${header}.${claims}`), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${header}.${claims}.${base64url(signature)}`;
}

/** The notification as Apple wants it; `url` rides along for the app to open when tapped. */
export function apnsPayload(message: { title: string; body: string; url?: string | null; tag?: string }) {
  return JSON.stringify({
    aps: { alert: { title: message.title, body: message.body }, sound: "default", ...(message.tag ? { "thread-id": message.tag } : {}) },
    url: message.url ?? "/bildirimler",
  });
}
