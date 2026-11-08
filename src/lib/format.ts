// Date helpers pinned to the studio's time zone. Istanbul has used a fixed UTC+3 offset since 2016,
// so "YYYY-MM-DD" day keys and "HH:MM" times can be turned into instants without a tz library.
export const STUDIO_TZ = "Europe/Istanbul";
const OFFSET = "+03:00";

const parts = (date: Date, options: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(new Intl.DateTimeFormat("tr-TR", { timeZone: STUDIO_TZ, ...options }).formatToParts(date).map((part) => [part.type, part.value]));

export function dayKey(date: Date): string {
  const p = parts(date, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}`;
}

export const todayKey = () => dayKey(new Date());

// Request-time clock helpers. Server Components render once per request, so reading the clock is intended.
export const hasStarted = (date: Date) => date.getTime() <= Date.now();
export const hoursUntil = (date: Date) => (date.getTime() - Date.now()) / 3_600_000;
export const fromNow = (days = 0) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
/** `date`, or now if `date` is already in the past — e.g. "the rest of today". */
export const notBeforeNow = (date: Date) => new Date(Math.max(date.getTime(), Date.now()));

export function isDayKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00${OFFSET}`));
}

export function atStudioTime(day: string, time: string): Date {
  return new Date(`${day}T${time}:00${OFFSET}`);
}

export function dayRange(day: string): [Date, Date] {
  const start = atStudioTime(day, "00:00");
  return [start, new Date(start.getTime() + 24 * 60 * 60 * 1000)];
}

export function addDays(day: string, amount: number): string {
  return dayKey(new Date(atStudioTime(day, "12:00").getTime() + amount * 24 * 60 * 60 * 1000));
}

export function isSunday(day: string): boolean {
  return atStudioTime(day, "12:00").getUTCDay() === 0;
}

/** Monday of the week that contains `day`. */
export function startOfWeek(day: string): string {
  const weekday = atStudioTime(day, "12:00").getUTCDay();
  return addDays(day, weekday === 0 ? -6 : 1 - weekday);
}

/** The next `count` days the studio is open (Monday–Saturday), starting today. */
/** The month (YYYY-MM) `amount` months before or after `month`. */
export function shiftMonth(month: string, amount: number) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function openDays(count: number, from = todayKey()): string[] {
  const days: string[] = [];
  for (let day = from; days.length < count; day = addDays(day, 1)) if (!isSunday(day)) days.push(day);
  return days;
}

export const formatTime = (date: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone: STUDIO_TZ, hour: "2-digit", minute: "2-digit" }).format(date);

/** "8 Ekim Perşembe" */
export function formatDayLong(date: Date): string {
  const p = parts(date, { day: "numeric", month: "long", weekday: "long" });
  return `${p.day} ${p.month} ${p.weekday}`;
}

/** "8 Ekim" */
export const formatDayMonth = (date: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone: STUDIO_TZ, day: "numeric", month: "long" }).format(date);

/** "Ekim 2026" */
export const formatMonthYear = (date: Date) => new Intl.DateTimeFormat("tr-TR", { timeZone: STUDIO_TZ, month: "long", year: "numeric" }).format(date);

/** { weekday: "Per", day: "08", month: "EKİ" } for compact date blocks. */
export function dayParts(date: Date) {
  const p = parts(date, { weekday: "short", day: "2-digit", month: "short" });
  return { weekday: p.weekday.replace(".", ""), day: p.day, month: p.month.replace(".", "").toLocaleUpperCase("tr-TR") };
}

export function relativeTime(date: Date, now = new Date()): string {
  const minutes = Math.round((now.getTime() - date.getTime()) / 60000);
  if (minutes < 1) return "Az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} gün önce`;
  return formatDayMonth(date);
}

export const lessonTypeLabels = { reformer: "Reformer Pilates" } as const;
export const lessonLevelLabels = { tum: "Tüm seviyeler", baslangic: "Başlangıç", orta: "Orta seviye", ileri: "İleri seviye" } as const;
export const bookingStatusLabels = { pending: "Onay bekliyor", approved: "Onaylandı", rejected: "Reddedildi", cancelled: "İptal edildi" } as const;

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("tr-TR")).join("");
}

/** RPE (rate of perceived exertion) anchors shown on the 1–10 effort scale. */
export const effortLabels: Record<number, string> = {
  1: "Çok hafif", 2: "Hafif", 3: "Orta", 4: "Biraz zorladı", 5: "Zorladı",
  6: "Epey zorladı", 7: "Çok zorladı", 8: "Çok çok zorladı", 9: "Neredeyse sınırımdaydım", 10: "Sınırımdaydım",
};
