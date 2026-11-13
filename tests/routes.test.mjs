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
  "rezervasyon/basarili", "rezervasyonlar", "rezervasyonlar/[id]", "yorum-yaz", "profil", "profil/ayarlar", "profil/ayarlar/bilgiler", "profil/ayarlar/bildirimler", "profil/ayarlar/guvenlik", "profil/ayarlar/hesap", "bildirimler",
  "rezervasyonlar/[id]/degistir",
  "egitmen-paneli", "egitmen-paneli/yeni-ders", "egitmen-paneli/talepler", "egitmen-paneli/talepler/[id]",
  "egitmen-paneli/takvim", "egitmen-paneli/dersler/[id]", "egitmen-paneli/dersler/[id]/duzenle", "egitmen-paneli/uyeler", "gelistirici/e-postalar", "eposta-dogrula",
  "sabit-saatler", "egitmen-paneli/sabit-saatler", "takvim", "egitmen-paneli/doluluk", "hesap-etkinlestir", "hesap-etkinlestir/tamam",
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
  const guarded = { "rezervasyonlar": "member", "profil": undefined, "bildirimler": undefined, "egitmen-paneli": "trainer", "egitmen-paneli/talepler": "trainer", "egitmen-paneli/yeni-ders": "trainer", "egitmen-paneli/uyeler": "trainer", "egitmen-paneli/dersler/[id]/duzenle": "trainer", "sabit-saatler": "member", "egitmen-paneli/sabit-saatler": "trainer", "takvim": "member", "egitmen-paneli/doluluk": "trainer" };
  for (const [route, role] of Object.entries(guarded)) {
    const page = readFileSync(join(app, route, "page.tsx"), "utf8");
    assert.match(page, /requireUser\(/, `/${route} requireUser çağırmıyor`);
    if (role) assert.match(page, new RegExp(`role: "${role}"`), `/${route} ${role} rolünü istemiyor`);
  }
  for (const file of ["auth.ts", "bookings.ts", "lessons.ts", "account.ts", "push.ts", "attendance.ts", "fixed-slots.ts", "packages.ts"]) {
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
  for (const route of ["giris", "uye-ol", "profil/ayarlar/bildirimler", "profil/ayarlar/guvenlik", "profil/ayarlar/hesap", "rezervasyon/basarili", "rehber"]) {
    const page = readFileSync(join(app, route, "page.tsx"), "utf8");
    assert.match(page, /isNativeApp\(\)/, `/${route} uygulamayı tanımıyor`);
  }
});

test("eğitmen de hesabını uygulamadan silebilir (App Store 5.1.1)", () => {
  const actions = readFileSync(join(app, "actions", "account.ts"), "utf8");
  assert.doesNotMatch(actions, /stüdyo üzerinden kapatılır/, "eğitmenin silme isteği reddedilmemeli");
  assert.match(actions, /deletedAt: new Date\(\)/);
  const settings = readFileSync(join(app, "profil/ayarlar/hesap/page.tsx"), "utf8");
  assert.match(settings, /TrainerDeleteAccountForm/);
  const queries = readFileSync(join(root, "src/lib/queries.ts"), "utf8");
  assert.match(queries, /isNull\(users\.deletedAt\)/, "silinen eğitmen listede görünmemeli");
});

test("uygulamada indirme yerine Safari ve paylaşım menüsü; geri kaydırma açık", () => {
  const route = readFileSync(join(app, "rezervasyonlar/[id]/takvim/route.ts"), "utf8");
  assert.match(route, /isValidCalendarToken\(/, "imzalı takvim bağlantısı kabul edilmeli");
  const detail = readFileSync(join(app, "rezervasyonlar/[id]/page.tsx"), "utf8");
  assert.match(detail, /calendarToken\(/);
  const settings = readFileSync(join(app, "profil/ayarlar/hesap/page.tsx"), "utf8");
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

test("alt menü ekrana sabit, sayfa esnemez; bildirim izni neden istendiğini anlatan pencereyle sorulur", () => {
  const css = readFileSync(join(app, "globals.css"), "utf8");
  assert.match(css, /\.flowly-bottom-nav\{position:fixed;left:0;right:0;bottom:0;/, "alt menü sayfayla kaymamalı");
  assert.match(css, /\.flowly-phone:has\(>\.flowly-bottom-nav\)\{padding-bottom:74px\}/, "sayfanın sonu menünün altında kalmamalı");
  assert.match(css, /html,body\{overscroll-behavior-y:none\}/);
  const scene = readFileSync(join(root, "ios/App/App/SceneDelegate.swift"), "utf8");
  assert.match(scene, /scrollView\.bounces = false/, "uygulamada sayfa uçlarda esnememeli");
  const native = readFileSync(join(root, "src/components/flowly/native.tsx"), "utf8");
  assert.match(native, /<PushAskSheet onEnable=\{enable\}\/>/, "uygulama bildirim izni açıklamalı pencereyle sorulmalı");
  const ask = readFileSync(join(root, "src/components/flowly/push-ask.tsx"), "utf8");
  assert.match(ask, /Eğitmen talebini onayladığında/, "pencere bildirimlerin ne için olduğunu söylemeli");
  assert.match(ask, /const MAX_ASKS = 3;/, "\"Şimdi değil\" diyene en fazla 3 kez sorulmalı");
});

test("ana renk her yerde aynı: eski siyaha yakın bordo kalmadı", () => {
  for (const file of ["src/app/globals.css", "src/lib/mail.ts", "mobil/www/index.html"]) {
    const text = readFileSync(join(root, file), "utf8");
    assert.doesNotMatch(text, /28171a|40,23,26/i, `${file} eski rengi kullanmamalı`);
    assert.match(text, /38070e|56,7,14/i, `${file} yeni bordoyu kullanmalı`);
  }
});

test("simgeler ve vurgular ana bordoyla aynı aileden: eski mor kalmadı", () => {
  for (const file of ["src/app/globals.css", "src/lib/mail.ts"]) {
    const text = readFileSync(join(root, file), "utf8");
    assert.doesNotMatch(text, /77556d|119,85,109/i, `${file} eski moru kullanmamalı`);
    assert.match(text, /7b2d3b|123,45,59/i, `${file} açık bordoyu kullanmalı`);
  }
});

test("rehber tek ekrana sığar, masaüstünde üst menü sayfayı uzatmaz, ayarlar simgesi dişli çark", () => {
  const css = readFileSync(join(app, "globals.css"), "utf8");
  assert.match(css, /\.tutorial-screen \.flowly-phone\{display:flex;flex-direction:column;height:100dvh\}/, "rehber telefonda tek ekran olmalı");
  assert.match(css, /\.flowly-app>\.flowly-phone\{flex:1 0 auto;min-height:0\}/, "masaüstünde kısa sayfalar kaymamalı");
  const guide = readFileSync(join(app, "rehber/page.tsx"), "utf8");
  assert.match(guide, /nav=\{false\}/, "rehberde alt menü olmamalı");
  const icons = readFileSync(join(root, "src/components/flowly/icons.tsx"), "utf8");
  assert.match(icons, /settings: <><path d="M12\.22 2h-\.44/, "ayarlar simgesi güneş değil dişli çark olmalı");
});

test("ayarlar dört alt sayfaya bölünür; bildirimler kaydırılarak silinir; eğitmen ders programına ulaşır", () => {
  const menu = readFileSync(join(app, "profil/ayarlar/page.tsx"), "utf8");
  for (const href of ["bilgiler", "bildirimler", "guvenlik", "hesap"]) assert.match(menu, new RegExp(`/profil/ayarlar/${href}"`), `${href} menüde olmalı`);
  const actions = readFileSync(join(app, "actions/account.ts"), "utf8");
  assert.match(actions, /export async function deleteNotification\(id: string\)/);
  assert.match(actions, /and\(eq\(notifications\.id, id\), eq\(notifications\.userId, user\.id\)\)/, "yalnızca kendi bildirimi silinebilmeli");
  assert.match(actions, /export async function updateEmailNotifications\(on: boolean\)/);
  const list = readFileSync(join(app, "bildirimler/page.tsx"), "utf8");
  assert.match(list, /<SwipeToDelete id=\{item\.id\}>/);
  const profile = readFileSync(join(app, "profil/page.tsx"), "utf8");
  assert.match(profile, /"\/dersler"\]/, "eğitmenin profil menüsünde ders programı olmalı");
  const requests = readFileSync(join(app, "egitmen-paneli/talepler/page.tsx"), "utf8");
  assert.match(requests, /className="see-all fixed-slots-link"/, "sabit saatler bağlantısı ortalanmalı");
});

test("uygulama ekranın kenarlarına kadar çizer: fotoğraflar tam ekran, sayfalar saatin altına girmez", () => {
  const config = readFileSync(join(root, "capacitor.config.ts"), "utf8");
  assert.match(config, /contentInset: "never"/);
  const layout = readFileSync(join(app, "layout.tsx"), "utf8");
  assert.match(layout, /viewportFit: "cover"/);
  const css = readFileSync(join(app, "globals.css"), "utf8");
  assert.match(css, /\.flowly-phone,\.home-screen\{padding-top:env\(safe-area-inset-top\);padding-bottom:env\(safe-area-inset-bottom\)\}/);
  assert.match(css, /\.flowly-bottom-nav\{height:calc\(74px \+ env\(safe-area-inset-bottom\)\)/);
  for (const page of ["rezervasyon/basarili", "splash", "onboarding"]) {
    assert.match(readFileSync(join(app, page, "page.tsx"), "utf8"), /<LightStatusBar\/>/, `${page}: koyu fotoğrafta saat beyaz olmalı`);
  }
  const settings = readFileSync(join(app, "profil/ayarlar/bilgiler/page.tsx"), "utf8");
  assert.doesNotMatch(settings, /Avatar/, "ayarlarda profil fotoğrafı olmamalı");
});

test("ziyaretçi ilk açılışta kala çiçeği fotoğraflı karşılama ekranını görür; sabit saatler bir kart", () => {
  const home = readFileSync(join(app, "page.tsx"), "utf8");
  assert.match(home, /if \(!user\) return <Welcome\/>;/, "giriş yapmamış kişi karşılama ekranını görmeli");
  for (const href of ["/uye-ol", "/giris", "/dersler"]) assert.match(home, new RegExp(`href="${href}"`));
  const css = readFileSync(join(app, "globals.css"), "utf8");
  assert.match(css, /\.welcome-photo\{[^}]*splash\.webp/);
  assert.doesNotMatch(css, /onboarding\.webp/, "kadın sırtı fotoğrafı kullanılmamalı");
  const bookings = readFileSync(join(app, "rezervasyonlar/page.tsx"), "utf8");
  assert.match(bookings, /className="fixed-slots-card"/);
});

test("stüdyo sayfasında dokununca tam ekran açılan fotoğraf galerisi; fotoğraflarda konum bilgisi yok", () => {
  const about = readFileSync(join(app, "hakkimizda/page.tsx"), "utf8");
  assert.match(about, /<StudioGallery photos=\{gallery\}\/>/);
  assert.doesNotMatch(about, /studio-main|studio-alt/, "galeride yalnızca stüdyonun kendi fotoğrafları olmalı");
  assert.match(readFileSync(join(root, "src/lib/studio.ts"), "utf8"), /heroImage: "\/images\/flowly\/studio-gallery-1\.jpg"/, "ana fotoğraf reformer salonu olmalı");
  assert.doesNotMatch(readFileSync(join(app, "profil/page.tsx"), "utf8"), /<Avatar/, "profilde fotoğraf olmamalı");
  const gallery = readFileSync(join(root, "src/components/flowly/gallery.tsx"), "utf8");
  assert.match(gallery, /role="dialog" aria-modal="true"/);
  for (const file of ["studio-gallery-1.jpg", "studio-gallery-2.jpg"]) {
    // The EXIF block (APP1) must not point to a GPS section (tag 0x8825).
    const bytes = readFileSync(join(root, "public/images/flowly", file));
    const app1 = bytes.indexOf(Buffer.from([0xff, 0xe1]));
    const exif = app1 < 0 ? Buffer.alloc(0) : bytes.subarray(app1 + 4, app1 + 2 + bytes.readUInt16BE(app1 + 2));
    assert.equal(exif.includes(Buffer.from([0x88, 0x25])) || exif.includes(Buffer.from([0x25, 0x88])), false, `${file} konum bilgisi taşımamalı`);
  }
});

test("uygulama giriş yapmış kişiyi doğrudan ders programına ya da eğitmen paneline açar", () => {
  const home = readFileSync(join(app, "page.tsx"), "utf8");
  assert.match(home, /if \(await isNativeApp\(\)\) redirect\(homeFor\(user\)\);/);
});

test("yapay zekâyla üretilmiş stüdyo ve kişi görselleri hiçbir yerde yok", () => {
  const gone = ["studio-main.webp", "studio-alt.webp", "instructor.webp", "member-selin.webp", "onboarding.webp", "map-kadikoy.webp", "mat.webp", "notification-flower.webp"];
  for (const file of gone) assert.equal(existsSync(join(root, "public/images/flowly", file)), false, `${file} silinmeli`);
  const sources = ["src/app/globals.css", "src/lib/studio.ts", "src/db/seed.ts", "src/app/hakkimizda/page.tsx", "src/lib/mail.ts"].map((file) => readFileSync(join(root, file), "utf8")).join("\n");
  for (const file of gone) assert.equal(sources.includes(file), false, `${file} hâlâ kullanılıyor`);
});

test("Özet ve Profil'deki rakamlar ilgili listeyi açar; bekleyen talep Talepler'e gider", () => {
  const panel = readFileSync(join(app, "egitmen-paneli/page.tsx"), "utf8");
  assert.match(panel, /<Link href="\/egitmen-paneli\/talepler"><strong>\{stats\.pending\}<\/strong><span>Bekleyen talep<\/span><\/Link>/);
  const profile = readFileSync(join(app, "profil/page.tsx"), "utf8");
  assert.match(profile, /\[s\.pending, "Bekleyen talep", "\/egitmen-paneli\/talepler"\]/);
  assert.match(profile, /\[s\.upcoming, "Yaklaşan", "\/rezervasyonlar"\]/);
});

test("yorum metinleri stüdyoya özel: eğitmen hepsini, üye yalnızca kendininkini görür; herkese puan ortalaması", () => {
  const list = readFileSync(join(app, "yorumlar/page.tsx"), "utf8");
  assert.match(list, /user \? listReviews\(\{ sort, memberId: trainer \? undefined : user\.id \}\) : \[\]/);
  const about = readFileSync(join(app, "hakkimizda/page.tsx"), "utf8");
  assert.doesNotMatch(about, /listReviews|review\.comment/, "Stüdyo sayfasında yorum metni olmamalı");
  const trainerPage = readFileSync(join(app, "egitmen/[id]/page.tsx"), "utf8");
  assert.match(trainerPage, /user\?\.role === "trainer" \? listReviews\(/);
  assert.doesNotMatch(readFileSync(join(app, "gizlilik/page.tsx"), "utf8"), /herkese açık gösterilir/);
});

test("hesapsız üye: e-postası .invalid, giriş yapamaz, eğitmen gerçek hesapla birleştirir; sabit saatte bir haftayı taşımak yalnızca o haftayı, kalıcı değişiklik eğitmen onayıyla saati değiştirir", () => {
  const members = readFileSync(join(root, "src/lib/members.ts"), "utf8");
  assert.match(members, /@uye\.flowly\.invalid/, "hesapsız üyenin e-postası hiçbir zaman gerçek bir adres olmamalı");
  assert.match(members, /placeholder: true/);
  assert.match(members, /if \(!from\?\.placeholder\)/, "yalnızca hesapsız kayıtlar birleştirilip silinebilmeli");
  const mail = readFileSync(join(root, "src/lib/mail.ts"), "utf8");
  assert.match(mail, /invalid/, ".invalid adreslere e-posta gönderilmemeli");
  const actions = readFileSync(join(app, "actions", "fixed-slots.ts"), "utf8");
  // Moving one week cancels that week's row; the daily fill never re-books a class the member has any row for.
  const fill = readFileSync(join(root, "src/lib/fixed-slots.ts"), "utf8");
  assert.match(fill, /const \[existing\] = await tx\.select\(\{ id: bookings\.id \}\)\.from\(bookings\)\.where\(and\(eq\(bookings\.lessonId, lesson\.id\), eq\(bookings\.memberId, slot\.memberId\)\)\);\s*if \(existing\) return null;/, "iptal edilen hafta tekrar doldurulmamalı");
  const fixedPage = readFileSync(join(app, "sabit-saatler", "page.tsx"), "utf8");
  assert.match(fixedPage, /\/degistir`\} className="see-all">Bu hafta başka güne al/);
  // A permanent change waits for a trainer; approving it ends the old time first.
  assert.match(actions, /export async function requestFixedSlotChange/);
  assert.match(actions, /decided\[0\]\.replacesSlotId \? await endFixedSlot\(/, "kalıcı değişiklik onaylanınca eski saat bitmeli");
  assert.match(actions, /export async function assignFixedSlots/);
  const queries = readFileSync(join(root, "src/lib/queries.ts"), "utf8");
  assert.match(queries, /not \$\{users\.placeholder\}\)`/, "hesapsız üye 'davet bekliyor' görünmemeli");
});
