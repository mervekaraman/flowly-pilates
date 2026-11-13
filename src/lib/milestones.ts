// Class-count milestones ("rozet") for members; pure rules, so they run in unit tests too.
// The first class is celebrated too: the first weeks decide whether a new member stays.

const FIXED = [1, 5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500];

/** True when attending this many classes earns a badge (every hundred after 500). */
export const isMilestone = (count: number) => FIXED.includes(count) || (count > 500 && count % 100 === 0);

/** The badge after `count` classes. */
export function nextMilestone(count: number): number {
  return FIXED.find((m) => m > count) ?? (Math.floor(count / 100) + 1) * 100;
}

/** Badges earned with `count` classes, oldest first. */
export function earnedMilestones(count: number): number[] {
  const earned = FIXED.filter((m) => m <= count);
  for (let m = 600; m <= count; m += 100) earned.push(m);
  return earned;
}

/** Badge name: "İlk ders" for the first, "10. ders" and so on. */
export const milestoneLabel = (count: number) => count === 1 ? "İlk ders" : `${count}. ders`;
