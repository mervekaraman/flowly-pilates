import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GOOGLE_ATTEMPT_COOKIE, googleAuthorizeUrl, isGoogleConfigured, newGoogleAttempt } from "@/lib/auth/google";
import { safeNext } from "@/lib/privacy";

// "Google ile devam et": remembers this attempt in a 10-minute cookie, then hands over to Google.
export async function GET(request: Request) {
  if (!isGoogleConfigured()) redirect("/giris?google=kapali");
  const next = safeNext(new URL(request.url).searchParams.get("sonra"));
  const attempt = newGoogleAttempt();
  (await cookies()).set(GOOGLE_ATTEMPT_COOKIE, Buffer.from(JSON.stringify({ ...attempt, next })).toString("base64url"), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/auth/google", maxAge: 600,
  });
  redirect(googleAuthorizeUrl(attempt));
}
