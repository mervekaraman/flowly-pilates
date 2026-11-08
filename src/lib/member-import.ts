// Pure parsing for the one-off member import from Excel (scripts/import-members.ts); no database,
// so it runs in unit tests too. Rows come from read-excel-file: strings, numbers, booleans, Dates or null.
import { z } from "zod";
import { normalizePhone } from "./forms.ts";
import { personName } from "./validation.ts";

export type ImportPackage = { lessonCount: number; startsOn: string; endsOn: string };
export type ImportMember = { row: number; name: string; email: string; phone: string; pkg: ImportPackage | null };
export type ImportIssue = { row: number; problems: string[] };
type Column = "name" | "email" | "phone" | "lessonCount" | "startsOn" | "endsOn";

/** Header spellings the studio might use, compared without case, accents, spaces or punctuation. */
const headerNames: Record<Column, string[]> = {
  name: ["adsoyad", "adisoyadi", "isimsoyisim", "isim", "ad", "uye", "uyeadi"],
  email: ["eposta", "email", "mail", "epostaadresi", "emailadresi"],
  phone: ["telefon", "cep", "ceptelefonu", "telefonnumarasi", "tel", "gsm", "telno"],
  lessonCount: ["derssayisi", "paketdersi", "paket", "dershakki", "ders"],
  startsOn: ["baslangic", "baslangictarihi", "paketbaslangic", "paketbaslangici"],
  endsOn: ["songun", "bitis", "bitistarihi", "sontarih", "paketbitis", "gecerlilik"],
};
export const templateHeaders = ["Ad Soyad", "E-posta", "Telefon", "Ders sayısı", "Başlangıç", "Son gün"];

const simplify = (value: unknown) => String(value ?? "").toLocaleLowerCase("tr").replace(/ı/g, "i").normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");
const text = (value: unknown) => (value instanceof Date ? "" : String(value ?? "")).trim();
const email = z.email();

/** Excel dates arrive as Date (UTC midnight), as a serial number, or typed as "30.11.2026" / "2026-11-30". */
export function cellDay(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && value > 30000 && value < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000).toISOString().slice(0, 10);
  const raw = text(value);
  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return check(Number(match[1]), Number(match[2]), Number(match[3]));
  match = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (match) return check(Number(match[3]), Number(match[2]), Number(match[1]));
  return null;
}
function check(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.toISOString().slice(0, 10) : null;
}

/**
 * Turns the first sheet into members to invite. The header row may be anywhere in the first five rows.
 * A package is optional; when a row has any package cell, lessons and last day are required (first day
 * defaults to `today`). Problems are reported per Excel row number, never silently dropped.
 */
export function parseMemberSheet(rows: unknown[][], today: string) {
  const headerIndex = rows.slice(0, 5).findIndex((row) => row.some((cell) => headerNames.email.includes(simplify(cell))));
  const header = headerIndex >= 0 ? rows[headerIndex] : [];
  const columns: Partial<Record<Column, number>> = {};
  header.forEach((cell, index) => {
    const key = simplify(cell);
    for (const [column, names] of Object.entries(headerNames) as [Column, string[]][]) if (columns[column] === undefined && names.includes(key)) columns[column] = index;
  });
  const missingColumns = (["name", "email", "phone"] as const).filter((column) => columns[column] === undefined).map((column) => templateHeaders[["name", "email", "phone"].indexOf(column)]);
  const members: ImportMember[] = [];
  const issues: ImportIssue[] = [];
  if (missingColumns.length) return { members, issues, missingColumns };

  const seen = new Set<string>();
  rows.slice(headerIndex + 1).forEach((cells, offset) => {
    const row = headerIndex + 2 + offset;
    const cell = (column: Column) => columns[column] === undefined ? null : cells[columns[column]!];
    if (cells.every((value) => text(value) === "" && !(value instanceof Date))) return;
    const problems: string[] = [];

    const name = personName.safeParse(text(cell("name")));
    if (!name.success) problems.push(`ad soyad: ${name.error.issues[0]?.message ?? "geçersiz"}`);
    const address = text(cell("email")).toLocaleLowerCase("en");
    if (!email.safeParse(address).success) problems.push("e-posta geçersiz");
    else if (seen.has(address)) problems.push("bu e-posta dosyada daha önce geçiyor");
    const phone = normalizePhone(text(cell("phone")) || String(cell("phone") ?? ""));
    if (!phone) problems.push("telefon geçersiz (ör. 0532 123 45 67)");

    let pkg: ImportPackage | null = null;
    const hasPackage = (["lessonCount", "startsOn", "endsOn"] as const).some((column) => { const value = cell(column); return value instanceof Date || text(value) !== ""; });
    if (hasPackage) {
      const lessonCount = Number(text(cell("lessonCount")).replace(",", "."));
      const startsOn = text(cell("startsOn")) === "" && !(cell("startsOn") instanceof Date) ? today : cellDay(cell("startsOn"));
      const endsOn = cellDay(cell("endsOn"));
      if (!Number.isInteger(lessonCount) || lessonCount < 1 || lessonCount > 200) problems.push("ders sayısı 1 ile 200 arasında tam sayı olmalı");
      if (!startsOn) problems.push("başlangıç tarihi okunamadı (ör. 01.11.2026)");
      if (!endsOn) problems.push("son gün okunamadı (ör. 30.11.2026)");
      if (startsOn && endsOn && endsOn < startsOn) problems.push("son gün başlangıçtan önce olamaz");
      if (!problems.length) pkg = { lessonCount, startsOn: startsOn!, endsOn: endsOn! };
    }

    if (problems.length) { issues.push({ row, problems }); return; }
    seen.add(address);
    members.push({ row, name: name.data!, email: address, phone: phone!, pkg });
  });
  return { members, issues, missingColumns };
}
