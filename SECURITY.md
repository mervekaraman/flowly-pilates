# Güvenlik notları

## Uygulanan korumalar

- Şifreler scrypt ile, oturum ve parola yenileme anahtarları yalnızca SHA-256 özetiyle saklanır.
- Parola yenileme bağlantılarının ham içeriği canlı e-posta kutusunda tutulmaz ve yeniden gönderim kuyruğuna girmez.
- Giriş ve parola yenileme hız sınırı PostgreSQL'de tutulur; birden çok sunucu örneğinde ortaktır.
- Parola değişince diğer cihazlardaki oturumlar kapatılır.
- Server Action'lar rol, sahiplik, saat ve kontenjan kurallarını sunucuda yeniden doğrular.
- CSP (yalnızca kendi alan adı + Spotify oynatıcısı), HSTS, frame, MIME, referrer ve tarayıcı izin başlıkları ayarlıdır.
- Supabase veri API'sine karşı bütün tablolarda RLS açıktır; test, RLS'siz tablo eklenmesine izin vermez.
- Kayıt, giriş, davet kodu (IP ve günlük toplam) ve e-posta değişikliği için deneme sınırları vardır. Girişte sıkı sınır hesap + IP başınadır (15 dakikada 8), ayrıca hesap başına gevşek (saatte 50) ve IP başına (15 dakikada 30) sınır vardır; böylece başkası bir üyenin e-postasıyla deneme yaparak onu dışarıda bırakamaz.
- Giriş sonrası yönlendirme yalnızca site içi yollara izin verir (kontrol karakteri ve başka alan adı reddedilir).
- Herkese açık yorumlarda üye adı "Elif Y." biçimindedir, fotoğraf gösterilmez; sunucu kayıtlarında e-posta maskelenir.
- Rezervasyon notu (sağlık verisi olabilir) yalnızca açık rızayla saklanır ve dersten 6 ay sonra silinir; e-posta kopyaları 30 gün tutulur.
- Üye; verilerini indirebilir, e-postasını onay bağlantısıyla değiştirebilir ve hesabını kalıcı silebilir. Çıkışta cihazın telefon bildirimleri durur.
- Veritabanı bağlantısı TLS'lidir; `DATABASE_CA_CERT` tanımlıysa sunucu sertifikası doğrulanır. Haftalık yedekler şifrelenerek saklanır; yedek için gereken GitHub gizli bilgileri (`BACKUP_DATABASE_URL`, `BACKUP_PASSPHRASE`) eksikse iş akışı hata verir (eskiden sessizce atlıyordu).
- Eğitmenin üyeleri etkileyen işlemleri (talep kararı, katılım, derse üye ekleme, ders iptali/düzenlemesi, sabit saat kararı, paket ekleme/silme) `audit_events` tablosuna kim/ne/ne zaman olarak yazılır; not ya da iletişim bilgisi yazılmaz, kayıtlar 1 yıl sonra silinir.
- Kök düzende bir hata olursa `global-error.tsx` ayrıntı göstermeden Türkçe bir hata ekranı gösterir; hata ayrıntısı yalnızca sunucu kayıtlarındadır.

## İşletim

- `npm run check` her değişiklikten önce çalıştırılmalıdır; GitHub Actions bunu push ve pull request'lerde tekrarlar.
- `npm audit --omit=dev` canlıya giden bağımlılıklar için sıfır açık vermelidir; CI yüksek ve kritik açıkta derlemeyi durdurur.
- Dependabot her pazartesi güncel olmayan paketler için PR açar; CodeQL her push, PR ve haftada bir kodu güvenlik açığı için tarar (Security › Code scanning).
- Vercel'deki günlük görev temizlik ve e-posta yeniden denemesini yapar; `npm run db:cleanup` / `npm run mail:retry` elle çalıştırılabilir.
- Canlı ortam `npm run check:production` ile doğrulanmalıdır.

## 8 Kasım 2026 denetimi

Liste: kimlik doğrulama, yetkilendirme, girdi doğrulama, SQL injection, XSS, CSRF, CORS, HTTPS, güvenli çerezler, istek sınırlama, sahiplik (IDOR), gizli anahtar yönetimi, dosya yükleme, hata yönetimi, güvenlik başlıkları, denetim kaydı, bağımlılık taraması, veritabanı güvenliği, yedekleme, CI/CD taraması.

- Next.js 16.3.8 → 16.4.5 (kritik: görsel optimizasyonunda ve `use cache`'te uzaktan kod çalıştırma; yüksek: Server Actions'ta hizmet dışı bırakma), zod → 4.6.7 (yüksek: aşırı büyük girdiyle bellek tüketme), nodemailer → 10.4 (orta: adres ayrıştırma). Güncelleme sonrası canlı bağımlılıklarda açık yok.
- Düzeltildi: giriş sınırıyla hesap kilitleme; onaylı dersi taşımanın 5 bekleyen talep sınırını atlaması; eğitmen dersi iptal edince üye notunun (sağlık verisi olabilir) silinmemesi; e-posta bildirimi anahtarının girdi doğrulaması.
- Eklendi: denetim kaydı, `global-error.tsx`, CI'da `npm audit`, Dependabot, CodeQL, yedek gizli bilgileri eksikse hata veren yedek iş akışı.
- Değişmedi, bilinçli: uygulama veritabanına sahip (owner) rolüyle bağlanır, RLS yalnızca Supabase veri API'sini kapatır. Ayrı, yetkisi sınırlı bir veritabanı rolü ileride düşünülebilir. Dosya yükleme özelliği yoktur.

## Geliştirme bağımlılığı uyarıları

5 Ekim 2026 denetiminde canlı bağımlılıklarda açık bulunmadı. Tam `npm audit`, yalnızca geliştirme zincirinde `eslint-config-next` üzerinden `braces` ve `drizzle-kit` içindeki eski loader üzerinden `esbuild` uyarıları verdi. NPM'in önerdiği `--force` çözümü Next.js ve Drizzle Kit'i uyumsuz eski ana sürümlere düşürdüğü için uygulanmadı. Bu paketler yeni uyumlu sürüm yayımladığında kontrollü olarak yükseltilmeli; geliştirme sunucusu güvenilmeyen ağlara açılmamalıdır.

Güvenlik bildirimlerinde hassas bilgi içermeden depo yöneticisiyle özel kanaldan iletişime geçin.
