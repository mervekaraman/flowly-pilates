import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bookings } from "@/db/schema";
import { bookingIcsFile } from "@/lib/booking-calendar";
import { isValidCalendarToken } from "@/lib/calendar-token";
import { getCurrentUser } from "@/lib/dal";
import { getMemberBooking, isUuid } from "@/lib/queries";

// "Takvime ekle": the member's own booking as an .ics file. iPhone opens it straight in Calendar;
// elsewhere it downloads and opens in the default calendar app. The iOS app opens this in Safari
// (its web view cannot handle .ics), where there is no session, so a signed ?anahtar= link is accepted too.
export async function GET(request: Request, ctx: RouteContext<"/rezervasyonlar/[id]/takvim">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  let memberId = user?.role === "member" ? user.id : null;
  if (!memberId && isUuid(id) && isValidCalendarToken(id, new URL(request.url).searchParams.get("anahtar"), process.env.AUTH_COOKIE_SECRET ?? "")) {
    const [row] = await (await getDb()).select({ memberId: bookings.memberId }).from(bookings).where(eq(bookings.id, id)).limit(1);
    memberId = row?.memberId ?? null;
  }
  const booking = memberId ? await getMemberBooking(memberId, id) : null;
  // Only confirmed bookings belong in a calendar; a once-approved booking that was cancelled
  // returns a cancellation so the earlier event disappears.
  if (!booking || (booking.status !== "approved" && !booking.decidedAt)) return new Response("Bulunamadı", { status: 404 });

  const cancelled = booking.status !== "approved" || booking.lessonStatus === "cancelled";
  const ics = bookingIcsFile({ id: booking.id, startsAt: booking.startsAt, durationMin: booking.durationMin, level: booking.level, trainerName: booking.trainerName, cancelled, changedAt: cancelled ? undefined : booking.decidedAt ?? booking.createdAt });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="flowly-pilates-${booking.startsAt.toISOString().slice(0, 10)}.ics"`,
      "Cache-Control": "private, no-store",
      // The signed link must not leak to other sites through the Referer header.
      "Referrer-Policy": "no-referrer",
    },
  });
}
