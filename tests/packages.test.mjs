import assert from "node:assert/strict";
import { test } from "node:test";
import { packageEndingSoon, packageForLesson, packageLowAlert, packageNeedsAttention, packageState, remainingOf } from "../src/lib/package-rules.ts";
import { occupancyGrid } from "../src/lib/occupancy.ts";

const pkg = (id, lessonCount, startsOn, endsOn, used = 0) => ({ id, lessonCount, startsOn, endsOn, used });

test("paket durumu: hiç paket yoksa 'none'", () => {
  assert.deepEqual(packageState([], "2026-11-10"), { kind: "none" });
});

test("paket durumu: bugün geçerli ve dersi kalan paket 'active', kalanlar toplanır", () => {
  const state = packageState([pkg("a", 8, "2026-11-01", "2026-11-30", 3), pkg("b", 4, "2026-11-05", "2026-12-05", 1)], "2026-11-10");
  assert.equal(state.kind, "active");
  assert.equal(state.pkg.id, "a", "önce biten paket gösterilir");
  assert.equal(state.remaining, 8);
});

test("paket durumu: dersleri biten paket 'exhausted', sorun olarak işaretlenir", () => {
  const state = packageState([pkg("a", 8, "2026-11-01", "2026-11-30", 8)], "2026-11-10");
  assert.equal(state.kind, "exhausted");
  assert.equal(packageNeedsAttention(state), true);
});

test("paket durumu: süresi dolan paket 'expired', kullanılmayan dersler raporlanır", () => {
  const state = packageState([pkg("a", 8, "2026-10-01", "2026-10-31", 6)], "2026-11-10");
  assert.equal(state.kind, "expired");
  assert.equal(state.remaining, 2);
  assert.equal(packageNeedsAttention(state), true);
});

test("paket durumu: ileri tarihli yeni paket, biten paketin önüne geçer", () => {
  const state = packageState([pkg("eski", 8, "2026-11-01", "2026-11-30", 8), pkg("yeni", 8, "2026-12-01", "2026-12-31")], "2026-11-20");
  assert.equal(state.kind, "upcoming");
  assert.equal(state.pkg.id, "yeni");
  assert.equal(packageNeedsAttention(state), false);
});

test("ders paketten düşer: tarihi kapsayan, hakkı kalan ve en önce biten paket seçilir", () => {
  const packages = [pkg("uzun", 8, "2026-11-01", "2026-12-15"), pkg("kisa", 4, "2026-11-01", "2026-11-20"), pkg("dolu", 4, "2026-11-01", "2026-11-18", 4)];
  assert.equal(packageForLesson(packages, "2026-11-10"), "kisa");
  assert.equal(packageForLesson(packages, "2026-11-25"), "uzun", "kısa paketin süresi bitince uzun paket kullanılır");
  assert.equal(packageForLesson(packages, "2026-12-20"), null, "hiçbir paket kapsamıyorsa düşülmez");
  assert.equal(remainingOf(pkg("x", 4, "2026-11-01", "2026-11-30", 6)), 0, "kalan ders eksiye düşmez");
});

test("doluluk tablosu: gün × saat başına ortalama doluluk ve ders sayısı", () => {
  const lessons = [
    { weekday: 2, time: "18:00", capacity: 4, taken: 4 },
    { weekday: 2, time: "18:00", capacity: 4, taken: 2 },
    { weekday: 4, time: "09:00", capacity: 4, taken: 0 },
  ];
  const grid = occupancyGrid(lessons);
  assert.deepEqual(grid.times, ["09:00", "18:00"]);
  assert.deepEqual(grid.cell(2, "18:00"), { lessons: 2, rate: 0.75, taken: 6, capacity: 8 });
  assert.deepEqual(grid.cell(4, "09:00"), { lessons: 1, rate: 0, taken: 0, capacity: 4 });
  assert.equal(grid.cell(1, "09:00"), null, "dersi olmayan hücre boş kalır");
  assert.equal(grid.overall, 0.5);
  assert.equal(grid.busiest?.time, "18:00");
  assert.equal(grid.quietest?.time, "09:00");
});

test("son ders ve biten paket uyarısı; yeni paket alındıysa uyarı yok", () => {
  assert.equal(packageLowAlert([pkg("a", 8, "2026-11-01", "2026-11-30", 7)], "2026-11-20"), "last");
  assert.equal(packageLowAlert([pkg("a", 8, "2026-11-01", "2026-11-30", 8)], "2026-11-20"), "empty");
  assert.equal(packageLowAlert([pkg("a", 8, "2026-11-01", "2026-11-30", 5)], "2026-11-20"), null, "3 ders varken sessiz");
  assert.equal(packageLowAlert([pkg("a", 8, "2026-11-01", "2026-11-30", 7), pkg("b", 4, "2026-11-10", "2026-12-10", 3)], "2026-11-20"), null, "iki geçerli paketin toplamı 2");
  assert.equal(packageLowAlert([pkg("a", 8, "2026-11-01", "2026-11-30", 7), pkg("yeni", 8, "2026-12-01", "2026-12-31")], "2026-11-20"), null, "yenilemiş üyeye uyarı yok");
});

test("süresi bir hafta içinde dolan ve dersi kalan paket için uyarı", () => {
  const ending = pkg("a", 8, "2026-11-01", "2026-11-25", 5);
  assert.equal(packageEndingSoon([ending], "2026-11-20", "2026-11-27")?.id, "a");
  assert.equal(packageEndingSoon([ending], "2026-11-10", "2026-11-17"), null, "bitişe daha çok var");
  assert.equal(packageEndingSoon([pkg("a", 8, "2026-11-01", "2026-11-25", 8)], "2026-11-20", "2026-11-27"), null, "dersi kalmamış pakete süre uyarısı yok");
  assert.equal(packageEndingSoon([ending, pkg("yeni", 8, "2026-11-26", "2026-12-31")], "2026-11-20", "2026-11-27"), null, "yenilemiş üyeye uyarı yok");
});

test("ders rozetleri: ilk ders, 5, 10, 25… ve 500'den sonra her yüz", async () => {
  const { isMilestone, nextMilestone, earnedMilestones, milestoneLabel } = await import("../src/lib/milestones.ts");
  assert.deepEqual([1, 5, 10, 25, 50].map(isMilestone), [true, true, true, true, true]);
  assert.deepEqual([2, 11, 26, 550].map(isMilestone), [false, false, false, false]);
  assert.equal(isMilestone(700), true);
  assert.equal(nextMilestone(0), 1);
  assert.equal(nextMilestone(7), 10);
  assert.equal(nextMilestone(500), 600);
  assert.deepEqual(earnedMilestones(12), [1, 5, 10]);
  assert.deepEqual(earnedMilestones(0), []);
  assert.equal(milestoneLabel(1), "İlk ders");
  assert.equal(milestoneLabel(25), "25. ders");
});
