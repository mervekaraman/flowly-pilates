import "server-only";
import { createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { appUrl } from "@/lib/mail";

// "Sign in with Google" over plain OpenID Connect (authorization code + PKCE). The ID token comes
// straight from Google's token endpoint over TLS, so checking issuer, audience, expiry and nonce is
// enough (OIDC Core 3.1.3.7); no third-party library or Google SDK is needed.

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// AUTH_COOKIE_SECRET signs the short-lived sign-up cookie; it is separate from the OAuth client
// secret so one leaked value cannot be used for both.
const cookieSecret = () => process.env.AUTH_COOKIE_SECRET ?? "";
export const isGoogleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && cookieSecret().length >= 32);
export const googleRedirectUri = () => `${appUrl()}/auth/google/callback`;

const base64url = (buffer: Buffer) => buffer.toString("base64url");

/** State, PKCE verifier and nonce for one sign-in attempt; kept in a short-lived httpOnly cookie. */
export function newGoogleAttempt() {
  return { state: base64url(randomBytes(24)), verifier: base64url(randomBytes(32)), nonce: base64url(randomBytes(24)) };
}

export function googleAuthorizeUrl(attempt: { state: string; verifier: string; nonce: string }) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state: attempt.state,
    nonce: attempt.nonce,
    code_challenge: base64url(createHash("sha256").update(attempt.verifier).digest()),
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/** `authoritative`: Google owns this address (gmail.com, or a Google Workspace domain with hd). */
export type GoogleProfile = { sub: string; email: string; name: string; authoritative: boolean };

export async function exchangeGoogleCode(code: string, verifier: string, nonce: string): Promise<GoogleProfile> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, code_verifier: verifier, grant_type: "authorization_code", redirect_uri: googleRedirectUri(),
      client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Google token isteği başarısız (${response.status})`);
  const { id_token: idToken } = await response.json() as { id_token?: string };
  const payload = idToken?.split(".")[1];
  if (!payload) throw new Error("Google kimlik bilgisi gelmedi");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;

  const issuerOk = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  if (!issuerOk || claims.aud !== process.env.GOOGLE_CLIENT_ID || typeof claims.exp !== "number" || claims.exp * 1000 < Date.now() || claims.nonce !== nonce) {
    throw new Error("Google kimlik bilgisi doğrulanamadı");
  }
  // Only an address Google has verified may open or join an account with that e-mail.
  if (claims.email_verified !== true || typeof claims.email !== "string" || typeof claims.sub !== "string") throw new Error("Google e-posta adresi doğrulanmamış");
  const email = claims.email.trim().toLowerCase();
  const name = typeof claims.name === "string" && claims.name.trim() ? claims.name.trim().slice(0, 80) : email.split("@")[0];
  const authoritative = /@(gmail|googlemail)\.com$/.test(email) || typeof claims.hd === "string";
  return { sub: claims.sub, email, name, authoritative };
}

/*
 * A first-time Google user still has to give a phone number and accept the privacy notice before
 * an account exists. Until then the verified profile waits in a signed, 15-minute cookie, so
 * nothing is stored about them without consent.
 */
type PendingSignup = GoogleProfile & { next: string | null; exp: number };

const signingKey = () => Buffer.from(hkdfSync("sha256", cookieSecret(), "flowly", "google-pending-signup-v1", 32));
const sign = (data: string) => createHmac("sha256", signingKey()).update(data).digest("base64url");

export function sealPendingSignup(profile: GoogleProfile, next: string | null) {
  const data = base64url(Buffer.from(JSON.stringify({ ...profile, next, exp: Date.now() + 15 * 60 * 1000 } satisfies PendingSignup)));
  return `${data}.${sign(data)}`;
}

export function openPendingSignup(value: string | undefined): PendingSignup | null {
  if (!value || !isGoogleConfigured()) return null;
  const [data, signature] = value.split(".");
  if (!data || !signature) return null;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const pending = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as PendingSignup;
    return pending.exp > Date.now() ? pending : null;
  } catch {
    return null;
  }
}

export const GOOGLE_ATTEMPT_COOKIE = "flowly_google";
export const GOOGLE_PENDING_COOKIE = "flowly_google_signup";
