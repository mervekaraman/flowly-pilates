import assert from "node:assert/strict";
import { test } from "node:test";
import { cellDay, parseMemberSheet, templateHeaders } from "../src/lib/member-import.ts";

const today = "2026-11-08";

test("Excel aktarımı: başlıklar esnek tanınır, telefon ve e-posta düzenlenir", () => {
  const rows = [
    ["İsim", "E-Mail", "Cep Telefonu"],
    ["Ayşe Demir", " Ayse@Flowly.TEST ", "0532 123 45 67"],
    ["Zeynep Kaya", "zeynep@flowly.test", 5551234567],
  ];
  const { members, issues, missingColumns } = parseMemberSheet(rows, today);
  assert.deepEqual(missingColumns, []);
  assert.deepEqual(issues, []);
  assert.deepEqual(members.map((m) => [m.row, m.name, m.email, m.phone, m.pkg]), [
    [2, "Ayşe Demir", "ayse@flowly.test", "+905321234567", null],
    [3, "Zeynep Kaya", "zeynep@flowly.test", "+905551234567", null],
  ]);
});

test("Excel aktarımı: paket sütunları; başlangıç boşsa bugün, tarih biçimleri", () => {
  const rows = [templateHeaders,
    ["Ayşe Demir", "ayse@flowly.test", "05321234567", 8, "", "30.11.2026"],
    ["Elif Su", "elif@flowly.test", "05321234568", "4", new Date(Date.UTC(2026, 10, 1)), "2026-11-30"],
  ];
  const { members, issues } = parseMemberSheet(rows, today);
  assert.deepEqual(issues, []);
  assert.deepEqual(members[0].pkg, { lessonCount: 8, startsOn: today, endsOn: "2026-11-30" });
  assert.deepEqual(members[1].pkg, { lessonCount: 4, startsOn: "2026-11-01", endsOn: "2026-11-30" });
});

test("Excel aktarımı: hatalı satırlar satır numarası ve sebebiyle raporlanır, boş satır atlanır", () => {
  const rows = [templateHeaders,
    ["Ayşe Demir", "ayse@flowly.test", "0532 123 45 67"],
    ["", "", ""],
    ["Ayşe Demir", "AYSE@flowly.test", "0532 123 45 67"],
    ["X", "bozuk", "123"],
    ["Elif Su", "elif@flowly.test", "05321234568", 8, "30.11.2026", "01.11.2026"],
  ];
  const { members, issues } = parseMemberSheet(rows, today);
  assert.equal(members.length, 1);
  assert.deepEqual(issues.map((issue) => issue.row), [4, 5, 6]);
  assert.match(issues[0].problems.join(), /daha önce geçiyor/);
  assert.equal(issues[1].problems.length, 3, "ad, e-posta ve telefon ayrı ayrı yazılır");
  assert.match(issues[2].problems.join(), /başlangıçtan önce/);
});

test("Excel aktarımı: zorunlu sütun yoksa hangisi eksik söylenir", () => {
  assert.deepEqual(parseMemberSheet([["Ad Soyad", "E-posta"], ["Ayşe Demir", "ayse@flowly.test"]], today).missingColumns, ["Telefon"]);
});

test("Excel tarihleri: Date, seri numara ve yazılı biçimler; geçersiz tarih reddedilir", () => {
  assert.equal(cellDay(new Date(Date.UTC(2026, 10, 30))), "2026-11-30");
  assert.equal(cellDay(46356), "2026-11-30");
  assert.equal(cellDay("30/11/2026"), "2026-11-30");
  assert.equal(cellDay("31.02.2026"), null);
  assert.equal(cellDay("yarın"), null);
});
