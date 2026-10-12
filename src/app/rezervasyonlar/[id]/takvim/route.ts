import { bookingIcsFile } from "@/lib/booking-calendar";
import { getCurrentUser } from "@/lib/dal";
import { getMemberBooking } from "@/lib/queries";

// "Takvime ekle": the member's own booking as an .ics file. iPhone opens it straight in Calendar;
// elsewhere it downloads and opens in the default calendar app.
export async function GET(_request: Request, ctx: RouteContext<"/rezervasyonlar/[id]/takvim">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  const booking = user?.role === "member" ? await getMemberBooking(user.id, id) : null;
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
    },
  });
}
