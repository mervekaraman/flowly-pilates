// Pure rules for lesson packages ("ders hakkı"); no database, so they run in unit tests too.
// Days are studio day keys (YYYY-MM-DD), which compare correctly as strings.

export type PackageUsage = { id: string; lessonCount: number; startsOn: string; endsOn: string; used: number };

export type PackageState =
  /** No package has ever been entered for the member. */
  | { kind: "none" }
  /** Valid today with lessons left; `remaining` adds up every package valid today. */
  | { kind: "active"; pkg: PackageUsage; remaining: number }
  /** Nothing valid today, but a package starts later. */
  | { kind: "upcoming"; pkg: PackageUsage }
  /** Valid today, but every lesson is used. */
  | { kind: "exhausted"; pkg: PackageUsage }
  /** The last package ended; `remaining` lessons were left unused. */
  | { kind: "expired"; pkg: PackageUsage; remaining: number };

export const remainingOf = (pkg: PackageUsage) => Math.max(0, pkg.lessonCount - pkg.used);
const byEnd = (a: PackageUsage, b: PackageUsage) => a.endsOn.localeCompare(b.endsOn) || a.startsOn.localeCompare(b.startsOn);

/** What the member's packages mean today. */
export function packageState(packages: PackageUsage[], today: string): PackageState {
  const current = packages.filter((pkg) => pkg.startsOn <= today && today <= pkg.endsOn).sort(byEnd);
  const withLessons = current.filter((pkg) => remainingOf(pkg) > 0);
  if (withLessons.length) return { kind: "active", pkg: withLessons[0], remaining: withLessons.reduce((sum, pkg) => sum + remainingOf(pkg), 0) };
  const upcoming = packages.filter((pkg) => pkg.startsOn > today).sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0];
  if (upcoming) return { kind: "upcoming", pkg: upcoming };
  if (current.length) return { kind: "exhausted", pkg: current[current.length - 1] };
  const last = packages.filter((pkg) => pkg.endsOn < today).sort(byEnd).at(-1);
  if (last) return { kind: "expired", pkg: last, remaining: remainingOf(last) };
  return { kind: "none" };
}

/** True when the trainer should be told the member has no lessons left to book against. */
export const packageNeedsAttention = (state: PackageState) => state.kind === "exhausted" || state.kind === "expired";

/**
 * The package a lesson on `lessonDay` is taken from: valid that day, with lessons left, ending
 * soonest (so lessons are not lost to an expiring package). Null when no package covers it.
 */
export function packageForLesson(packages: PackageUsage[], lessonDay: string): string | null {
  return packages.filter((pkg) => pkg.startsOn <= lessonDay && lessonDay <= pkg.endsOn && remainingOf(pkg) > 0).sort(byEnd)[0]?.id ?? null;
}

/**
 * Right after a lesson is taken from a package: "last" when one lesson is left, "empty" when none
 * are. Null when there is nothing to say, including when a later package is already in place.
 */
export function packageLowAlert(packages: PackageUsage[], today: string): "last" | "empty" | null {
  if (packages.some((pkg) => pkg.startsOn > today && remainingOf(pkg) > 0)) return null;
  const state = packageState(packages, today);
  if (state.kind === "active" && state.remaining === 1) return "last";
  if (state.kind === "exhausted") return "empty";
  return null;
}

/**
 * A package valid today that ends by `lastDay` with lessons still unused, unless another package
 * with lessons runs past it (the member already renewed). The daily job warns once per package.
 */
export function packageEndingSoon<T extends PackageUsage>(packages: T[], today: string, lastDay: string): T | null {
  const pkg = packages.filter((p) => p.startsOn <= today && today <= p.endsOn && p.endsOn <= lastDay && remainingOf(p) > 0).sort(byEnd)[0];
  if (!pkg) return null;
  return packages.some((p) => p.id !== pkg.id && p.endsOn > pkg.endsOn && remainingOf(p) > 0) ? null : pkg;
}
