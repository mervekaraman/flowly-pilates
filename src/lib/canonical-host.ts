// The studio's own address (flowlypilates.com) replaced flowlypilates.vercel.app, because *.vercel.app
// is blocked on Turkish mobile networks. Pure rules, no Next.js imports, so they run in unit tests too.
import { isNativeAppUserAgent } from "./native-app.ts";

/** The old production address. Vercel preview addresses (other *.vercel.app hosts) are left alone. */
export const OLD_HOSTS = ["flowlypilates.vercel.app"];

/**
 * Where a request to the old address should be sent, or null to serve it as is.
 * `canonical` comes from the CANONICAL_URL setting (e.g. https://flowlypilates.com); while it is unset
 * nothing is redirected. The iOS app is never redirected: an app build that still points at the old
 * address must keep working there (it shows an update banner instead), and API calls stay put too.
 */
export function canonicalRedirect(canonical: string | undefined, url: URL, userAgent: string | null): string | null {
  if (!canonical) return null;
  const target = new URL(canonical);
  if (!OLD_HOSTS.includes(url.hostname) || url.hostname === target.hostname) return null;
  if (isNativeAppUserAgent(userAgent) || url.pathname.startsWith("/api/")) return null;
  return `${target.origin}${url.pathname}${url.search}`;
}

/** True for an iOS app build that still opens the old address (it cannot reach the site on mobile data). */
export const isOldAppBuild = (host: string | null, userAgent: string | null) =>
  Boolean(host && OLD_HOSTS.includes(host.split(":")[0]) && isNativeAppUserAgent(userAgent));
