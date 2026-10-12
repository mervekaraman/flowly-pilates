import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const app = join(root, "src/app");

const routes = [
  "", "splash", "onboarding", "giris", "uye-ol", "sifre-sifirlama", "sifre-sifirlama/yeni",
  "dersler", "dersler/[id]", "hakkimizda", "egitmen/[id]", "yorumlar", "yardim", "gizlilik",
  "rezervasyon/basarili", "rezervasyonlar", "rezervasyonlar/[id]", "yorum-yaz", "profil", "profil/ayarlar", "bildirimler",
  "rezervasyonlar/[id]/degistir",
  "egitmen-paneli", "egitmen-paneli/yeni-ders", "egitmen-paneli/talepler", "egitmen-paneli/talepler/[id]",
  "egitmen-paneli/takvim", "egitmen-paneli/dersler/[id]", "egitmen-paneli/dersler/[id]/duzenle", "egitmen-paneli/uyeler", "gelistirici/e-postalar", "eposta-dogrula",
];

test("tek stüdyo (Flowly Pilates) sayfalarının route dosyaları bulunur", () => {
  for (const route of routes) assert.equal(existsSync(join(app, route, "page.tsx")), true, `/${route} route'u eksik`);
});

test("çok stüdyolu eski ekranlar kaldırıldı ve yeni sayfalara yönlendiriliyor", () => {
  const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
  for (const route of ["kesfet", "harita", "arama", "favoriler", "konum-izni", "studyo"]) {
    assert.equal(existsSync(join(app, route)), false, `/${route} hâlâ duruyor`);
    assert.match(config, new RegExp(`source: "/${route}`), `/${route} için yönlendirme yok`);
  }
});

test("korumalı sayfalar veri katmanında oturum ve rol kontrolü yapar", () => {
  const guarded = { "rezervasyonlar": "member", "profil": undefined, "bildirimler": undefined, "egitmen-paneli": "trainer", "egitmen-paneli/talepler": "trainer", "egitmen-paneli/yeni-ders": "trainer", "egitmen-paneli/uyeler": "trainer", "egitmen-paneli/dersler/[id]/duzenle": "trainer" };
  for (const [route, role] of Object.entries(guarded)) {
    const page = readFileSync(join(app, route, "page.tsx"), "utf8");
    assert.match(page, /requireUser\(/, `/${route} requireUser çağırmıyor`);
    if (role) assert.match(page, new RegExp(`role: "${role}"`), `/${route} ${role} rolünü istemiyor`);
  }
  for (const file of ["auth.ts", "bookings.ts", "lessons.ts", "account.ts", "push.ts", "attendance.ts"]) {
    const actions = readFileSync(join(app, "actions", file), "utf8");
    assert.match(actions, /^"use server";/);
  }
});

test("ödeme ekranı ve ders ücreti yok; üyeler ödemeyi başta toplu yapar", () => {
  assert.equal(existsSync(join(app, "odeme")), false);
  const walk = (dir) => readdirSync(dir).flatMap((name) => statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]);
  for (const file of walk(join(root, "src")).filter((path) => /\.tsx?$/.test(path))) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /PaymentScreen|Kart numarası|href="\/odeme|priceTl|formatPrice|price_tl/, file);
  }
});

test("tasarım tokenları ve masaüstü üst menüsü korunur", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /--ivory:#f1edda/);
  assert.match(css, /--cta:#28171a/);
  assert.match(css, /width:min\(100%,430px\)/);
  assert.match(css, /@media\(min-width:1024px\)\{\.flowly-app>\.site-header\{display:block\}\}/);
});

test("telefon bildirimleri: service worker, manifest ve yalnızca bilinen push servisleri", () => {
  const root = new URL("../", import.meta.url);
  assert.equal(existsSync(new URL("public/sw.js", root)), true);
  assert.equal(existsSync(new URL("src/app/manifest.ts", root)), true);
  for (const icon of ["icon-192.png", "icon-512.png", "badge-96.png"]) assert.equal(existsSync(new URL(`public/icons/${icon}`, root)), true, icon);
  const actions = readFileSync(new URL("src/app/actions/push.ts", root), "utf8");
  assert.match(actions, /requireUser\(\)/, "abonelik giriş yapmış kullanıcıya bağlanmalı");
  assert.match(actions, /fcm\\.googleapis\\.com/, "uç noktalar push servisleriyle sınırlı olmalı (SSRF)");
  const config = readFileSync(new URL("next.config.ts", root), "utf8");
  assert.match(config, /source: "\/sw\.js"/, "service worker önbelleğe alınmamalı");
});

test("günlük görev yalnızca gizli anahtarla çalışır ve Vercel'de her gün planlıdır", () => {
  const route = readFileSync(join(app, "api/cron/gunluk/route.ts"), "utf8");
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /timingSafeEqual/);
  const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.deepEqual(vercel.crons, [{ path: "/api/cron/gunluk", schedule: "0 14 * * *" }]);
  const backup = readFileSync(new URL("../.github/workflows/yedek.yml", import.meta.url), "utf8");
  assert.match(backup, /--symmetric --cipher-algo AES256/, "yedek şifrelenmeden yüklenmemeli");
});

test("güvenlik: şifre bağlantıları saklanmaz, hız sınırı kalıcıdır ve başlıklar ayarlıdır", () => {
  const mail = readFileSync(join(root, "src/lib/mail.ts"), "utf8");
  const notify = readFileSync(join(root, "src/lib/notify.ts"), "utf8");
  const limiter = readFileSync(join(root, "src/lib/rate-limit.ts"), "utf8");
  const config = readFileSync(join(root, "next.config.ts"), "utf8");
  assert.match(notify, /sensitive: true/);
  assert.match(mail, /keepLink = !email\.sensitive/);
  assert.match(limiter, /rateLimits/);
  assert.match(config, /Content-Security-Policy/);
  assert.match(config, /Strict-Transport-Security/);
});
