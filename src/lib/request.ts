import "server-only";
import { headers } from "next/headers";
import { onRender, onVercel } from "@/lib/hosting";
import { isNativeAppUserAgent } from "@/lib/native-app";

/** True when the page is being viewed inside the Flowly iOS app rather than a browser. */
export async function isNativeApp() {
  return isNativeAppUserAgent((await headers()).get("user-agent"));
}

/**
 * The visitor's IP for rate limiting, from the one header each host sets itself:
 * - Vercel: x-real-ip, its own copy of the client address.
 * - Render: true-client-ip, set by the Cloudflare edge in front of it. Render's x-forwarded-for
 *   keeps whatever the caller sent, so it is never used there.
 * Anywhere else the headers could be forged, so local runs share one bucket instead.
 */
export async function clientIp() {
  if (onVercel()) {
    const list = await headers();
    return list.get("x-real-ip")?.trim() || list.get("x-forwarded-for")?.split(",")[0]?.trim() || "bilinmiyor";
  }
  if (onRender()) return (await headers()).get("true-client-ip")?.trim() || "bilinmiyor";
  return "yerel";
}
