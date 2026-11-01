// Pure rules for fixed weekly times ("sabit saat"); no database, so they run in unit tests too.
import { atStudioTime, dayKey, formatTime } from "./format.ts";
import { lessonStartTimes } from "./studio.ts";

/** ISO weekdays the studio is open, 1 = Monday … 6 = Saturday. */
export const fixedSlotWeekdays = [1, 2, 3, 4, 5, 6] as const;
export const weekdayLabels: Record<number, string> = { 1: "Pazartesi", 2: "Salı", 3: "Çarşamba", 4: "Perşembe", 5: "Cuma", 6: "Cumartesi" };
export const fixedSlotStatusLabels = { pending: "Onay bekliyor", active: "Aktif", rejected: "Onaylanmadı", ended: "Sona erdi" } as const;

/** A member can hold at most one open time per open day. */
export const MAX_FIXED_SLOTS = fixedSlotWeekdays.length;

export const isFixedSlotWeekday = (value: number) => (fixedSlotWeekdays as readonly number[]).includes(value);
export const isFixedSlotTime = (value: string) => lessonStartTimes.includes(value);

/** The weekly slot a class falls in, read on the studio's (Istanbul) clock. */
export function slotOf(startsAt: Date): { weekday: number; startTime: string } {
  const sundayFirst = atStudioTime(dayKey(startsAt), "12:00").getUTCDay();
  return { weekday: sundayFirst === 0 ? 7 : sundayFirst, startTime: formatTime(startsAt) };
}

export const matchesSlot = (startsAt: Date, slot: { weekday: number; startTime: string }) => {
  const lesson = slotOf(startsAt);
  return lesson.weekday === slot.weekday && lesson.startTime === slot.startTime;
};

/** "Salı · 08:00" */
export const slotLabel = (slot: { weekday: number; startTime: string }) => `${weekdayLabels[slot.weekday] ?? "?"} · ${slot.startTime}`;

type SearchParams = Record<string, string | string[] | undefined>;

/** Notice after a fixed time was ended; the action redirects with the counts in the URL. */
export function stoppedNotice(params: SearchParams, cancellationHours: number): string | null {
  if (params.kaldirildi !== "1") return null;
  const freed = Number(params.iptal) || 0;
  const kept = Number(params.kalan) || 0;
  return `Sabit saat kaldırıldı.${freed ? ` ${freed} ileri tarihli rezervasyon iptal edildi.` : ""}${kept ? ` Derse ${cancellationHours} saatten az kaldığı için ${kept} rezervasyon yerinde kaldı.` : ""}`;
}

/**
 * Classes are only booked automatically while the member could still cancel them online, so an
 * automatic booking never leaves anyone holding a seat they cannot give back.
 */
export const autoBookCutoff = (cancellationHours: number, now = Date.now()) => new Date(now + cancellationHours * 3_600_000);
