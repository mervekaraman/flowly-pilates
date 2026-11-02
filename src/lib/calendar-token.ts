// Signed, short-lived "add to calendar" links for the iOS app. The app's web view cannot open an
// .ics file, so the link is handed to Safari, which has no sign-in cookie: the signature proves the
// link was made for this booking by the signed-in member. Pure (no database) so it is unit-tested.
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

/** A day: long enough for a page left open, short enough that an old link stops working. */
export const CALENDAR_LINK_TTL_MS = 24 * 60 * 60 * 1000;

const key = (secret: string) => Buffer.from(hkdfSync("sha256", secret, "flowly", "calendar-link-v1", 32));
const signature = (bookingId: string, expires: number, secret: string) =>
  createHmac("sha256", key(secret)).update(`${bookingId}.${expires}`).digest("base64url");

/** "<expires>.<signature>", or null when no usable secret is configured. */
export function calendarToken(bookingId: string, secret: string, now = Date.now()): string | null {
  if (secret.length < 32) return null;
  const expires = now + CALENDAR_LINK_TTL_MS;
  return `${expires}.${signature(bookingId, expires, secret)}`;
}

export function isValidCalendarToken(bookingId: string, token: string | null | undefined, secret: string, now = Date.now()): boolean {
  if (!token || secret.length < 32) return false;
  const [expiresText, given] = token.split(".");
  const expires = Number(expiresText);
  if (!Number.isSafeInteger(expires) || expires < now || !given) return false;
  const expected = Buffer.from(signature(bookingId, expires, secret));
  const received = Buffer.from(given);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
