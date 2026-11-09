// One-off import of the studio's existing members from an Excel file (.xlsx).
//
//   Boş şablon:   npm run members:import -- --sablon aktarim/uye-sablonu.xlsx
//   Önizleme:     npm run members:import -- aktarim/uyeler.xlsx
//   Uygula:       npm run members:import -- aktarim/uyeler.xlsx --uygula
//   Davet yenile: npm run members:import -- aktarim/uyeler.xlsx --uygula --yeniden-davet
//
// Columns: Ad Soyad, E-posta, Telefon, and optionally Ders sayısı, Başlangıç, Son gün (a lesson package).
// Without --uygula nothing is written. New members get an account without a password, their package and
// an invite e-mail (lib/invites.ts); members already in the app are never duplicated, only their package
// is added. Run it again after fixing rows: it is safe to repeat. Output never shows names or phones,
// and e-mail addresses are masked. Real member files belong in the git-ignored `aktarim/` folder.
//
// Against the live database (take a backup first): DATABASE_URL=… APP_URL=https://flowlypilates.com
// plus the SMTP_* settings, then the same commands.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { inArray } from "drizzle-orm";
import { readSheet } from "read-excel-file/node";
import writeExcelFile from "write-excel-file/node";
import { getDb } from "../src/db";
import { memberPackages, users } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth/password";
import { audit } from "../src/lib/audit";
import { todayKey } from "../src/lib/format";
import { createInviteLink, isPendingInvite } from "../src/lib/invites";
import { appUrl, isMailConfigured } from "../src/lib/mail";
import { parseMemberSheet, templateHeaders, type ImportMember } from "../src/lib/member-import";
import { sendInviteEmail } from "../src/lib/notify";
import { maskEmail } from "../src/lib/privacy";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const trDay = (day: string) => day.split("-").reverse().join(".");
const pkgLabel = (member: ImportMember) => member.pkg ? ` · paket ${member.pkg.lessonCount} ders, ${trDay(member.pkg.startsOn)} – ${trDay(member.pkg.endsOn)}` : "";

async function writeTemplate(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  await writeExcelFile([templateHeaders.map((value) => ({ value, fontWeight: "bold" as const }))]).toFile(path);
  console.log(`Boş şablon oluşturuldu: ${path}\nSütunlar: ${templateHeaders.join(", ")}. Paket sütunları isteğe bağlı; tarihleri 30.11.2026 gibi yazabilirsin.`);
}

async function main() {
  if (flag("--sablon")) return writeTemplate(args[args.indexOf("--sablon") + 1] ?? "aktarim/uye-sablonu.xlsx");
  const file = args.find((arg) => !arg.startsWith("--"));
  if (!file || !existsSync(file)) throw new Error("Excel dosyasının yolunu yaz, ör. npm run members:import -- aktarim/uyeler.xlsx");
  const apply = flag("--uygula"), resend = flag("--yeniden-davet");

  const { members, issues, missingColumns } = parseMemberSheet(await readSheet(file), todayKey());
  if (missingColumns.length) throw new Error(`Dosyada şu sütunlar bulunamadı: ${missingColumns.join(", ")}. İlk satırda başlıklar olmalı.`);

  const db = await getDb();
  const existing = members.length ? await db.select({ id: users.id, email: users.email, role: users.role, passwordSet: users.passwordSet, googleSub: users.googleSub })
    .from(users).where(inArray(users.email, members.map((member) => member.email))) : [];
  const byEmail = new Map(existing.map((user) => [user.email, user]));
  const fresh = members.filter((member) => !byEmail.has(member.email));
  const known = members.filter((member) => byEmail.get(member.email)?.role === "member");
  const trainers = members.filter((member) => byEmail.get(member.email)?.role === "trainer");
  const waiting = known.filter((member) => isPendingInvite(byEmail.get(member.email)!));
  // The same package (lessons and dates) is never entered twice, so a repeated run adds nothing.
  const knownIds = known.map((member) => byEmail.get(member.email)!.id);
  const packageKey = (memberId: string, pkg: { lessonCount: number; startsOn: string; endsOn: string }) => `${memberId}|${pkg.lessonCount}|${pkg.startsOn}|${pkg.endsOn}`;
  const entered = new Set((knownIds.length ? await db.select({ memberId: memberPackages.memberId, lessonCount: memberPackages.lessonCount, startsOn: memberPackages.startsOn, endsOn: memberPackages.endsOn })
    .from(memberPackages).where(inArray(memberPackages.memberId, knownIds)) : []).map((row) => packageKey(row.memberId, row)));
  const newPackage = (member: ImportMember) => member.pkg && !entered.has(packageKey(byEmail.get(member.email)!.id, member.pkg));

  console.log(`\n${file}: ${members.length} geçerli satır, ${issues.length} hatalı satır.`);
  console.log(`  Yeni hesap açılacak:  ${fresh.length} (paketli ${fresh.filter((member) => member.pkg).length})`);
  console.log(`  Zaten uygulamada:     ${known.length} (yeni paketi eklenecek ${known.filter(newPackage).length}, daveti henüz kullanılmamış ${waiting.length})`);
  if (trainers.length) console.log(`  Eğitmen hesabı, atlanacak: satır ${trainers.map((member) => member.row).join(", ")}`);
  for (const issue of issues) console.log(`  ✗ Satır ${issue.row}: ${issue.problems.join("; ")}`);
  console.log(`\n  Davet e-postası: ${isMailConfigured() ? "gerçekten GÖNDERİLECEK (.test gibi deneme adreslerine hiç gitmez)" : "SMTP ayarlı değil, gönderilmeyecek (yalnızca kayda geçer)"} · bağlantılar ${appUrl()} adresine gider.`);
  for (const member of fresh) console.log(`  + Satır ${member.row} · ${maskEmail(member.email)}${pkgLabel(member)}`);

  if (!apply) {
    console.log("\nBu bir önizlemeydi; hiçbir şey değişmedi. Uygulamak için komutun sonuna --uygula ekle.");
    return;
  }

  let created = 0, packages = 0, invites = 0;
  for (const member of fresh) {
    // A random password nobody knows: the member sets their own from the invite link.
    const passwordHash = await hashPassword(randomBytes(24).toString("base64url"));
    const [user] = await db.insert(users).values({ name: member.name, email: member.email, phone: member.phone, role: "member", passwordHash, passwordSet: false })
      .onConflictDoNothing().returning({ id: users.id });
    if (!user) continue;
    created += 1;
    if (member.pkg) { await db.insert(memberPackages).values({ memberId: user.id, ...member.pkg }); packages += 1; }
    await sendInviteEmail(member, await createInviteLink(user.id), member.pkg);
    invites += 1;
    // Spread real e-mails out a little so the studio mailbox is not flagged for bursts.
    if (isMailConfigured()) await sleep(1500);
  }
  for (const member of known) {
    const user = byEmail.get(member.email)!;
    if (member.pkg && newPackage(member)) { await db.insert(memberPackages).values({ memberId: user.id, ...member.pkg }); packages += 1; }
    if (resend && isPendingInvite(user)) {
      await sendInviteEmail(member, await createInviteLink(user.id), member.pkg);
      invites += 1;
      if (isMailConfigured()) await sleep(1500);
    }
  }
  await audit(null, "member.import", { type: "users" }, `${created} hesap, ${packages} paket, ${invites} davet`);
  console.log(`\nTamam: ${created} hesap açıldı, ${packages} paket eklendi, ${invites} davet e-postası hazırlandı.`);
}

main().then(() => process.exit(0), (error) => { console.error(`\nDurdu: ${error instanceof Error ? error.message : error}`); process.exit(1); });
