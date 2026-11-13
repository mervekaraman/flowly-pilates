import { timingSafeEqual } from "node:crypto";
import { bookFixedSlots, cleanUp, retryMail, sendTomorrowReminders, warnEndingPackages } from "@/lib/jobs";

// Daily job (Vercel Cron, see vercel.json): fixed weekly times, tomorrow's reminders, packages ending soon, database
// clean-up, failed-mail retry.
// Vercel calls it with "Authorization: Bearer <CRON_SECRET>"; nobody else can trigger it.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const allowed = secret ? given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected)) : process.env.NODE_ENV === "development";
  if (!allowed) return new Response("Yetkisiz", { status: 401 });

  // Before the reminders, so a seat booked now for tomorrow still gets its reminder.
  const fixed = await bookFixedSlots();
  const reminders = await sendTomorrowReminders();
  const packages = await warnEndingPackages();
  const removed = await cleanUp();
  const mail = await retryMail();
  return Response.json({ ok: true, fixed, reminders, packages, removed, mail });
}
