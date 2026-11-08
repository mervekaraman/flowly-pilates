import assert from "node:assert/strict";
import { test } from "node:test";
import { packageForLesson, packageNeedsAttention, packageState, remainingOf } from "../src/lib/package-rules.ts";
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
