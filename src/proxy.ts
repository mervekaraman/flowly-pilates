import { NextResponse, type NextRequest } from "next/server";

// Optimistic gate only: it looks for the session cookie and never touches the database.
// The real checks (valid session, correct role) happen in the Data Access Layer on every page and action.
const protectedPrefixes = ["/rezervasyonlar", "/rezervasyon/basarili", "/yorum-yaz", "/profil", "/bildirimler", "/egitmen-paneli", "/rehber"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) && !request.cookies.has("smeda_session")) {
    const url = new URL("/giris", request.url);
    url.searchParams.set("sonra", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|images|favicon.ico).*)"],
};
