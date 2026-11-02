import "server-only";
import { headers } from "next/headers";
import { isNativeAppUserAgent } from "@/lib/native-app";

/** True when the page is being viewed inside the Flowly iOS app rather than a browser. */
export async function isNativeApp() {
  return isNativeAppUserAgent((await headers()).get("user-agent"));
}

/**
 * The visitor's IP for rate limiting. Only Vercel's edge sets these headers trustworthily
 * (x-real-ip is its own copy of the client address); anywhere else they could be forged by the
 * caller, so local runs share one bucket instead.
 */
export async function clientIp() {
  if (!process.env.VERCEL) return "yerel";
  const list = await headers();
  return list.get("x-real-ip")?.trim() || list.get("x-forwarded-for")?.split(",")[0]?.trim() || "bilinmiyor";
}
