import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const app = join(root, "src/app");

const routes = [
  "", "splash", "onboarding", "giris", "uye-ol", "sifre-sifirlama", "sifre-sifirlama/yeni",
  "dersler", "dersler/[id]", "hakkimizda", "egitmen/[id]", "yorumlar", "yardim", "rehber", "gizlilik",
  "rezervasyon/basarili", "rezervasyonlar", "rezervasyonlar/[id]", "yorum-yaz", "profil", "profil/ayarlar", "bildirimler",
  "rezervasyonlar/[id]/degistir",
  "egitmen-paneli", "egitmen-paneli/yeni-ders", "egitmen-paneli/talepler", "egitmen-paneli/talepler/[id]",
  "egitmen-paneli/takvim", "egitmen-paneli/dersler/[id]", "egitmen-paneli/dersler/[id]/duzenle", "egitmen-paneli/uyeler", "gelistirici/e-postalar", "eposta-dogrula",
  "sabit-saatler", "egitmen-paneli/sabit-saatler",
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
  const guarded = { "rezervasyonlar": "member", "profil": undefined, "bildirimler": undefined, "egitmen-paneli": "trainer", "egitmen-paneli/talepler": "trainer", "egitmen-paneli/yeni-ders": "trainer", "egitmen-paneli/uyeler": "trainer", "egitmen-paneli/dersler/[id]/duzenle": "trainer", "sabit-saatler": "member", "egitmen-paneli/sabit-saatler": "trainer" };
  for (const [route, role] of Object.entries(guarded)) {
    const page = readFileSync(join(app, route, "page.tsx"), "utf8");
    assert.match(page, /requireUser\(/, `/${route} requireUser çağırmıyor`);
    if (role) assert.match(page, new RegExp(`role: "${role}"`), `/${route} ${role} rolünü istemiyor`);
  }
  for (const file of ["auth.ts", "bookings.ts", "lessons.ts", "account.ts", "push.ts", "attendance.ts", "fixed-slots.ts"]) {
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
  assert.match(css, /--ivory:#f8f5e8/);
  assert.match(css, /--cta:#38070e/);
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

test("uygulama içinde Google girişi ve tarayıcı bildirimi gösterilmez", () => {
  for (const route of ["giris", "uye-ol", "profil/ayarlar", "rezervasyon/basarili", "rehber"]) {
    const page = readFileSync(join(app, route, "page.tsx"), "utf8");
    assert.match(page, /isNativeApp\(\)/, `/${route} uygulamayı tanımıyor`);
  }
});

test("eğitmen de hesabını uygulamadan silebilir (App Store 5.1.1)", () => {
  const actions = readFileSync(join(app, "actions", "account.ts"), "utf8");
  assert.doesNotMatch(actions, /stüdyo üzerinden kapatılır/, "eğitmenin silme isteği reddedilmemeli");
  assert.match(actions, /deletedAt: new Date\(\)/);
  const settings = readFileSync(join(app, "profil/ayarlar/page.tsx"), "utf8");
  assert.match(settings, /TrainerDeleteAccountForm/);
  const queries = readFileSync(join(root, "src/lib/queries.ts"), "utf8");
  assert.match(queries, /isNull\(users\.deletedAt\)/, "silinen eğitmen listede görünmemeli");
});

test("uygulamada indirme yerine Safari ve paylaşım menüsü; geri kaydırma açık", () => {
  const route = readFileSync(join(app, "rezervasyonlar/[id]/takvim/route.ts"), "utf8");
  assert.match(route, /isValidCalendarToken\(/, "imzalı takvim bağlantısı kabul edilmeli");
  const detail = readFileSync(join(app, "rezervasyonlar/[id]/page.tsx"), "utf8");
  assert.match(detail, /calendarToken\(/);
  const settings = readFileSync(join(app, "profil/ayarlar/page.tsx"), "utf8");
  assert.match(settings, /inApp \? <ShareDataButton\/>/);
  const scene = readFileSync(join(root, "ios/App/App/SceneDelegate.swift"), "utf8");
  assert.match(scene, /allowsBackForwardNavigationGestures = true/);
  assert.match(scene, /rootViewController = FlowlyBridgeViewController\(\)/);
});

test("oturum kapısı yalnızca imzalı takvim bağlantısını geçirir", () => {
  const proxy = readFileSync(join(root, "src/proxy.ts"), "utf8");
  assert.match(proxy, /\^\\\/rezervasyonlar\\\/\[\^\/\]\+\\\/takvim\$/, "muafiyet yalnızca takvim yoluna olmalı");
  assert.match(proxy, /searchParams\.has\("anahtar"\)/);
});

test("uygulama açılışta logoyu, ilk sayfa çizilene kadar gösterir", () => {
  const layout = readFileSync(join(app, "layout.tsx"), "utf8");
  assert.match(layout, /<NativeReady\/>/, "kök düzen açılış ekranını kapatmalı");
  const config = readFileSync(join(root, "capacitor.config.ts"), "utf8");
  assert.match(config, /SplashScreen: \{[^}]*launchAutoHide: true/s, "bir sorun olursa açılış ekranı kendiliğinden kalkmalı");
  const offline = readFileSync(join(root, "mobil/www/index.html"), "utf8");
  assert.match(offline, /SplashScreen\?\.hide\(\)/, "bağlantı yokken de açılış ekranı kalkmalı");
});

test("uygulama bildirimleri: Apple anahtarı iletilir, izin ve dokununca açılan sayfa bağlı", () => {
  const delegate = readFileSync(join(root, "ios/App/App/AppDelegate.swift"), "utf8");
  assert.match(delegate, /capacitorDidRegisterForRemoteNotifications/);
  const entitlements = readFileSync(join(root, "ios/App/App/App.entitlements"), "utf8");
  assert.match(entitlements, /aps-environment/);
  const project = readFileSync(join(root, "ios/App/App.xcodeproj/project.pbxproj"), "utf8");
  assert.equal((project.match(/CODE_SIGN_ENTITLEMENTS = App\/App.entitlements;/g) ?? []).length, 2, "Debug ve Release aynı izinleri kullanmalı");
  const push = readFileSync(join(root, "src/lib/push.ts"), "utf8");
  assert.match(push, /sendApns\(userId, message\)/, "her bildirim uygulamaya da gitmeli");
  const shell = readFileSync(join(root, "src/components/flowly/shell.tsx"), "utf8");
  assert.match(shell, /<NativePushSync signedIn=/);
  const config = readFileSync(join(root, "capacitor.config.ts"), "utf8");
  assert.match(config, /const APP_URL = process\.env\.FLOWLY_APP_URL \|\| LIVE_URL;/, "geliştirme adresi yalnızca ortam değişkeniyle değişmeli");
});

test("telefon düzeni: sayfa yana kaymaz, iPhone alanlara dokununca büyütmez, hata yazısı çizgiye binmez", () => {
  const css = readFileSync(join(app, "globals.css"), "utf8");
  assert.match(css, /html,body\{max-width:100%;overflow-x:clip\}/, "sayfa hiçbir zaman yana kaymamalı");
  // iPhone zooms into any form field whose text is under 16px, and a zoomed page slides sideways.
  const small = [...css.matchAll(/(?:^|\})([^{}]*\b(?:input|select|textarea)\b[^{}]*)\{[^}]*font-size:(1[0-5])px/g)].map((m) => m[1].trim());
  assert.deepEqual(small.filter((selector) => !/button|span/.test(selector)), [], "form alanları en az 16px olmalı");
  assert.doesNotMatch(css, /\.check-error\{[^}]*margin:-/, "hata yazısı yukarı, çizginin üstüne çekilmemeli");
  assert.doesNotMatch(css, /\.select-control select:focus-visible\{outline:2px/, "açılır listede çerçeve olmamalı");
});

test("alt menü ekrana sabit, sayfa esnemez; uygulama bildirim kartında buton alt satırda", () => {
  const css = readFileSync(join(app, "globals.css"), "utf8");
  assert.match(css, /\.flowly-bottom-nav\{position:fixed;left:0;right:0;bottom:0;/, "alt menü sayfayla kaymamalı");
  assert.match(css, /\.flowly-phone:has\(>\.flowly-bottom-nav\)\{padding-bottom:74px\}/, "sayfanın sonu menünün altında kalmamalı");
  assert.match(css, /html,body\{overscroll-behavior-y:none\}/);
  const scene = readFileSync(join(root, "ios/App/App/SceneDelegate.swift"), "utf8");
  assert.match(scene, /scrollView\.bounces = false/, "uygulamada sayfa uçlarda esnememeli");
  const native = readFileSync(join(root, "src/components/flowly/native.tsx"), "utf8");
  assert.match(native, /className="flowly-button whatsapp-button".*>Bildirimleri Aç</, "buton metnin yanına sıkışmamalı");
});

test("ana renk her yerde aynı: eski siyaha yakın bordo kalmadı", () => {
  for (const file of ["src/app/globals.css", "src/lib/mail.ts", "mobil/www/index.html"]) {
    const text = readFileSync(join(root, file), "utf8");
    assert.doesNotMatch(text, /28171a|40,23,26/i, `${file} eski rengi kullanmamalı`);
    assert.match(text, /38070e|56,7,14/i, `${file} yeni bordoyu kullanmalı`);
  }
});
