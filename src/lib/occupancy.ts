// Pure maths for the trainers' occupancy summary ("doluluk"); no database, so it runs in unit tests too.

/** Day names by ISO weekday (index 1 = Monday … 7 = Sunday). */
export const weekdayShort = ["", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
export const weekdayLong = ["", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

/** One past class: ISO weekday (1 = Monday … 7 = Sunday), start time "HH:MM", seats and seats taken. */
export type OccupancyLesson = { weekday: number; time: string; capacity: number; taken: number };
export type OccupancyCell = { lessons: number; rate: number; taken: number; capacity: number };
export type OccupancySlot = OccupancyCell & { weekday: number; time: string };

/** Classes grouped by weekday and start time, with the average share of seats filled. */
export function occupancyGrid(lessons: OccupancyLesson[]) {
  const cells = new Map<string, OccupancyCell>();
  for (const lesson of lessons) {
    const key = `${lesson.weekday}|${lesson.time}`;
    const cell = cells.get(key) ?? { lessons: 0, rate: 0, taken: 0, capacity: 0 };
    cell.lessons += 1;
    cell.taken += Math.min(lesson.taken, lesson.capacity);
    cell.capacity += lesson.capacity;
    cell.rate = cell.capacity ? cell.taken / cell.capacity : 0;
    cells.set(key, cell);
  }
  const slots: OccupancySlot[] = [...cells.entries()].map(([key, cell]) => {
    const [weekday, time] = key.split("|");
    return { ...cell, weekday: Number(weekday), time };
  });
  const taken = slots.reduce((sum, slot) => sum + slot.taken, 0);
  const capacity = slots.reduce((sum, slot) => sum + slot.capacity, 0);
  // Ties go to the slot with more classes behind it, so one lucky class does not win.
  const ranked = [...slots].sort((a, b) => b.rate - a.rate || b.lessons - a.lessons);
  return {
    times: [...new Set(slots.map((slot) => slot.time))].sort(),
    cell: (weekday: number, time: string) => cells.get(`${weekday}|${time}`) ?? null,
    overall: capacity ? taken / capacity : 0,
    totalLessons: lessons.length,
    totalTaken: taken,
    busiest: ranked[0] ?? null,
    quietest: ranked.length > 1 ? ranked.at(-1)! : null,
  };
}
