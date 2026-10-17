import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "../src/lib/auth/password.ts";
import { addDays, atStudioTime, dayKey, formatDayLong, isDayKey, isSunday, openDays, startOfWeek } from "../src/lib/format.ts";
import { formatPhone, normalizePhone } from "../src/lib/forms.ts";
import { lessonDefaults, lessonStartTimes } from "../src/lib/studio.ts";
import { whatsappLink, whatsappMessage } from "../src/lib/whatsapp.ts";
import { bookingIcs, googleCalendarLink } from "../src/lib/calendar.ts";
import { parseSpotifyLink } from "../src/lib/spotify.ts";
import { maskEmail, publicName, safeNext } from "../src/lib/privacy.ts";
import { contentSecurityPolicy } from "../src/lib/csp.ts";
import { personName } from "../src/lib/validation.ts";

test("şifreler tuzlanarak hash'lenir ve yalnızca doğru şifre eşleşir", async () => {
  const hash = await hashPassword("reformer-2026");
  assert.match(hash, /^scrypt\$16384\$8\$1\$/);
  assert.notEqual(hash, await hashPassword("reformer-2026"), "aynı şifre her seferinde farklı tuzla hash'lenmeli");
  assert.equal(await verifyPassword("reformer-2026", hash), true);
  assert.equal(await verifyPassword("Reformer-2026", hash), false);
  assert.equal(await verifyPassword("reformer-2026", "bozuk-hash"), false);
});

test("Türkiye cep telefonları E.164 biçimine çevrilir", () => {
  assert.equal(normalizePhone("0532 123 45 67"), "+905321234567");
  assert.equal(normalizePhone("532-123-4567"), "+905321234567");
  assert.equal(normalizePhone("+90 (532) 123 45 67"), "+905321234567");
  assert.equal(normalizePhone("12345"), null);
  assert.equal(formatPhone("+905321234567"), "+90 532 123 45 67");
});

test("tarihler stüdyo saatine (İstanbul, UTC+3) göre hesaplanır", () => {
  assert.equal(atStudioTime("2026-10-08", "18:30").toISOString(), "2026-10-08T15:30:00.000Z");
  assert.equal(dayKey(new Date("2026-10-07T22:30:00Z")), "2026-10-08", "İstanbul'da gece 01:30 yeni güne aittir");
  assert.equal(formatDayLong(atStudioTime("2026-10-08", "12:00")), "8 Ekim Perşembe");
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(isDayKey("2026-10-08"), true);
  assert.equal(isDayKey("08.10.2026"), false);
});

test("ders günleri pazartesi–cumartesi; pazar atlanır", () => {
  assert.equal(isSunday("2026-10-11"), true);
  const days = openDays(7, "2026-10-05");
  assert.deepEqual(days, ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-12"]);
  assert.equal(startOfWeek("2026-10-11"), "2026-10-05");
  assert.equal(startOfWeek("2026-10-05"), "2026-10-05");
});

test("dersler yalnızca saat başında açılır; varsayılan kontenjan 4 kişi", () => {
  assert.equal(lessonStartTimes[0], "07:00");
  assert.equal(lessonStartTimes.at(-1), "21:00");
  assert.equal(lessonStartTimes.length, 15);
  for (const time of lessonStartTimes) assert.match(time, /^\d{2}:00$/);
  assert.equal(lessonDefaults.capacity, 4);
  assert.equal("priceTl" in lessonDefaults, false, "ders başına ücret tutulmaz");
});

test("WhatsApp bağlantısı üyenin numarasına hazır mesajla açılır", () => {
  const text = whatsappMessage({ topic: "approved", memberName: "Elif Yılmaz", trainerName: "Duygu Kaya", startsAt: new Date("2026-10-06T15:00:00Z"), siteUrl: "https://smeda.test" });
  assert.match(text, /^Merhaba Elif, 6 Ekim Salı 18:00 reformer dersin için rezervasyonun onaylandı\./);
  assert.match(text, /Duygu · Flowly Pilates$/);
  const link = whatsappLink("+905321234567", text);
  assert.ok(link.startsWith("https://wa.me/905321234567?text="));
  assert.equal(new URL(link).searchParams.get("text"), text);
  assert.equal(whatsappLink(null, text), null);
  assert.equal(whatsappLink("123", text), null);
  const rejected = whatsappMessage({ topic: "rejected", memberName: "Selin", trainerName: "Ece Sarı", startsAt: new Date("2026-10-06T15:00:00Z"), trainerNote: "Bu saat dolu.", siteUrl: "https://smeda.test" });
  assert.match(rejected, /Notum: Bu saat dolu\./);
  assert.match(rejected, /https:\/\/smeda\.test\/dersler/);
});

test("takvime ekle: .ics dosyası, iptal güncellemesi ve Google bağlantısı", () => {
  const event = { uid: "booking-1@smeda-pilates", startsAt: new Date("2026-10-09T15:00:00Z"), endsAt: new Date("2026-10-09T15:50:00Z"), title: "Reformer Pilates · Smeda Pilates", description: "Orta seviye, Eğitmen: Duygu; iptal 12 saat", location: "Smeda Pilates", url: "https://smeda.test/rezervasyonlar/1", sequence: 3 };
  const ics = bookingIcs(event, new Date("2026-10-08T10:00:00Z"));
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /METHOD:PUBLISH\r\n/);
  assert.match(ics, /DTSTART:20261009T150000Z\r\n/);
  assert.match(ics, /DTEND:20261009T155000Z\r\n/);
  assert.match(ics, /DESCRIPTION:Orta seviye\\, Eğitmen: Duygu\\; iptal 12 saat/);
  assert.match(ics, /TRIGGER:-PT1H/);
  for (const line of ics.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, `uzun satır: ${line}`);
  // A lone CR (or any control character) in user text must not start a new property.
  const injected = bookingIcs({ ...event, description: "Duygu\rATTENDEE:mailto:x@evil.test\u0007" });
  assert.doesNotMatch(injected, /\r(?!\n)/);
  assert.doesNotMatch(injected, /\r\nATTENDEE/);
  assert.match(injected, /DESCRIPTION:Duygu\\nATTENDEE:mailto:x@evil.test\r\n/);
  const cancel = bookingIcs({ ...event, cancelled: true, sequence: 4 });
  assert.match(cancel, /METHOD:CANCEL/);
  assert.match(cancel, /STATUS:CANCELLED/);
  assert.match(cancel, /UID:booking-1@smeda-pilates/);
  const google = new URL(googleCalendarLink(event));
  assert.equal(google.searchParams.get("dates"), "20261009T150000Z/20261009T155000Z");
  assert.equal(google.searchParams.get("action"), "TEMPLATE");
});

test("üyenin Spotify listesi: yalnızca Spotify bağlantıları, izleme parametresi atılır", () => {
  const id = "37i9dQZF1DXcBWIGoYBM5M";
  assert.deepEqual(parseSpotifyLink(`https://open.spotify.com/playlist/${id}?si=abc123`), { url: `https://open.spotify.com/playlist/${id}`, embedUrl: `https://open.spotify.com/embed/playlist/${id}`, kind: "playlist" });
  assert.equal(parseSpotifyLink(`https://open.spotify.com/intl-tr/album/${id}`)?.url, `https://open.spotify.com/album/${id}`);
  assert.equal(parseSpotifyLink(`spotify:playlist:${id}`)?.embedUrl, `https://open.spotify.com/embed/playlist/${id}`);
  assert.equal(parseSpotifyLink("https://spotify.link/AbC123xyz")?.kind, "link");
  assert.equal(parseSpotifyLink("https://evil.example/playlist/x"), null);
  assert.equal(parseSpotifyLink(`https://open.spotify.com.evil.com/playlist/${id}`), null);
  assert.equal(parseSpotifyLink("javascript:alert(1)"), null);
  assert.equal(parseSpotifyLink(""), null);
});

test("gizlilik: herkese açık adlar kısaltılır, kayıtlarda e-posta maskelenir, yönlendirme siteden çıkamaz", () => {
  assert.equal(publicName("Elif Yılmaz"), "Elif Y.");
  assert.equal(publicName("Ayşe Nur İnce"), "Ayşe İ.");
  assert.equal(publicName("Derya"), "Derya");
  assert.equal(maskEmail("ornek.uye@gmail.com"), "o***@gmail.com");
  assert.equal(safeNext("/dersler/abc?gun=2026-10-09"), "/dersler/abc?gun=2026-10-09");
  assert.equal(safeNext("/rezervasyonlar#efor"), "/rezervasyonlar#efor");
  for (const attack of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "/.//evil.com", "/..//evil.com", "/a/..//evil.com", "/%2e//evil.com", "/./\\evil.com", "https://evil.com", "javascript:alert(1)", "", null, undefined]) {
    assert.equal(safeNext(attack), null, `reddedilmeli: ${JSON.stringify(attack)}`);
  }
});

test("güvenlik politikası: script yalnızca nonce ile, sayfa çerçevelenemez", () => {
  const csp = contentSecurityPolicy("abc123", false);
  const script = csp.split("; ").find((part) => part.startsWith("script-src"));
  assert.equal(script, "script-src 'self' 'nonce-abc123' 'strict-dynamic'");
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /upgrade-insecure-requests/);
  assert.match(contentSecurityPolicy("x", true), /'unsafe-eval'/);
});

test("ad soyad: harfler, boşluk, kesme ve tire; bağlantı ya da numara yok", () => {
  assert.equal(personName.parse("  Elif   Yılmaz "), "Elif Yılmaz");
  assert.equal(personName.parse("Ayşe-Nur O’Brien"), "Ayşe-Nur O’Brien");
  for (const bad of ["Kazandınız www.evil.com", "Ara 0555 000 00 00", "<b>x</b>", "a", "x".repeat(81)]) {
    assert.equal(personName.safeParse(bad).success, false, `reddedilmeli: ${bad}`);
  }
});
