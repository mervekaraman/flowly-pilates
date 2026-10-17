import "server-only";
import { headers } from "next/headers";

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
