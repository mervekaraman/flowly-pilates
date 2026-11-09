import { NextResponse, type NextRequest } from "next/server";
import { canonicalRedirect } from "@/lib/canonical-host";
import { contentSecurityPolicy, newNonce } from "@/lib/csp";

// Runs before every page: sets the per-request Content-Security-Policy, and is an optimistic
// sign-in gate that only looks for the session cookie and never touches the database.
// The real checks (valid session, correct role) happen in the Data Access Layer on every page and action.
const protectedPrefixes = ["/rezervasyonlar", "/rezervasyon/basarili", "/yorum-yaz", "/profil", "/bildirimler", "/egitmen-paneli", "/rehber"];

// The iOS app opens "add to calendar" in Safari, which has no session; the route checks the link's signature itself.
const isSignedCalendarLink = (url: NextRequest["nextUrl"]) => /^\/rezervasyonlar\/[^/]+\/takvim$/.test(url.pathname) && url.searchParams.has("anahtar");

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // Browsers on the old vercel.app address move to the studio's own domain (see lib/canonical-host.ts).
  const moved = canonicalRedirect(process.env.CANONICAL_URL, request.nextUrl, request.headers.get("user-agent"));
  if (moved) return NextResponse.redirect(moved, 308);
  if (protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) && !request.cookies.has("smeda_session") && !isSignedCalendarLink(request.nextUrl)) {
    const url = new URL("/giris", request.url);
    url.searchParams.set("sonra", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  // Next.js reads the nonce from the request's CSP header and puts it on its own scripts.
  const csp = contentSecurityPolicy(newNonce());
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|images|icons|favicon.ico|sw.js|manifest.webmanifest).*)"],
};
