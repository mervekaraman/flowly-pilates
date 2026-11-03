# App Store hazırlığı

App Store Connect'te uygulama kaydı açılırken doldurulacak alanlar. Karakter sınırları Apple'ın; metinler bu sınırların içinde.

## Temel bilgiler

| Alan | Değer |
| --- | --- |
| Uygulama adı (en fazla 30) | Flowly Pilates |
| Alt başlık (en fazla 30) | Reformer ders rezervasyonu |
| Paket kimliği | `com.mervekaraman.flowly` |
| Birincil kategori | Sağlık ve Fitness |
| İkincil kategori | Yaşam Tarzı |
| Yaş sınırı | 4+ (anketteki bütün sorulara "Hayır") |
| Fiyat | Ücretsiz, uygulama içi satın alma yok |
| Destek adresi | https://flowlypilates.vercel.app/yardim |
| Gizlilik politikası | https://flowlypilates.vercel.app/gizlilik |
| Pazarlama adresi | https://flowlypilates.vercel.app |
| Yayın ülkesi | Yalnızca Türkiye (AB'de ticari satıcı bilgisi istenmez) |

Uygulama adı başka bir uygulamada kullanılıyorsa Apple kabul etmez. O durumda "Flowly Pilates Stüdyo" gibi bir ad deneyin.

## Tanıtım metni (en fazla 170)

Reformer derslerine yerini birkaç dokunuşla ayır. Sabit saatini bir kez seç, her hafta otomatik yerin hazır olsun.

## Açıklama

Flowly Pilates, stüdyomuzun reformer derslerine yer ayırmanın en kolay yolu.

Ders programı
Pazartesi'den cumartesiye bütün dersleri saat, seviye, eğitmen ve kalan yer sayısıyla gör. Sana uyan saati seç ve talebini gönder.

Sabit saat
Her hafta aynı gün ve saatte mi geliyorsun? Sabit saatini bir kez seç; eğitmenin onayladıktan sonra o saatteki derslere her hafta otomatik olarak eklenirsin.

Rezervasyonların tek yerde
Onay bekleyen, onaylanan ve geçmiş derslerini gör. Planın değişirse derse 12 saat kalana kadar iptal et ya da başka bir saate taşı. Dersi tek dokunuşla takvimine ekle.

Bekleme listesi
Dolu derslerde bekleme listesine katıl; yer açılınca haber verelim.

Dersten sonra
Eforunu 1–10 arasında puanla, dersini değerlendir. Eğitmenin dersleri buna göre ayarlasın.

Eğitmenler için
Ders saatleri aç, talepleri onayla, katılımı işaretle ve sabit saat taleplerini yönet.

Ödemeler stüdyoda, üyelik başında yapılır; uygulamada ödeme alınmaz.

## Anahtar kelimeler (en fazla 100, virgülle)

pilates,reformer,rezervasyon,ders,stüdyo,fitness,egzersiz,randevu,spor,bayrampaşa

## Uygulama gizliliği formu

İzleme (tracking) yok: veriler reklam için ya da başka şirketlerle birleştirilmek için kullanılmıyor.

| Veri türü | Toplanıyor mu | Kullanıcıya bağlı | Amaç |
| --- | --- | --- | --- |
| Ad | Evet | Evet | Uygulama işlevi |
| E-posta adresi | Evet | Evet | Uygulama işlevi |
| Telefon numarası | Evet (üye olurken zorunlu; stüdyo üyeye ulaşabilsin diye) | Evet | Uygulama işlevi |
| Sağlık | Evet (rezervasyon notu, isteğe bağlı ve açık rızayla) | Evet | Uygulama işlevi |
| Diğer kullanıcı içeriği (yorum, efor puanı) | Evet | Evet | Uygulama işlevi |
| Kullanıcı kimliği | Evet | Evet | Uygulama işlevi |
| Konum, kişiler, fotoğraflar, tarama geçmişi, reklam verisi | Hayır | | |

## İnceleme notu (Apple'a İngilizce yazılır)

> Flowly Pilates is the booking app of a single reformer Pilates studio in Istanbul. Members browse the class schedule (no sign-in needed: "Önce ders programına göz at" on the first screen), request a seat, and the trainer approves it. Members can also set a fixed weekly time and are then booked automatically every week.
>
> Native features: push notifications through APNs (booking approved, class cancelled, reminder the day before; permission is asked only when the user taps "Bildirimleri Aç"), haptic feedback on a successful booking, the iOS share sheet to save the personal data export, swipe-to-go-back, and an offline screen when there is no connection.
>
> Classes are physical services delivered in the studio. Memberships are paid at the studio; the app has no payments of any kind (guideline 3.1.3(e)).
>
> Demo member account: (e-posta) / (şifre)
> Demo trainer account: (e-posta) / (şifre)
> Trainer accounts are opened with the studio's invite code; please use the demo trainer account above.
>
> Account deletion: Profil (bottom bar) › gear icon › "Verilerim ve hesap" › "Hesabımı sil" (members and trainers).
>
> To see a booking approved: sign in with the demo member, open a class and send "Rezervasyon Talebi Gönder"; then sign in with the demo trainer, open "Talepler" and approve it.
> The app is in Turkish.

Demo hesapların şifrelerini bu dosyaya değil, yalnızca App Store Connect'teki ilgili alanlara yazın.

Demo hesapları, dersleri ve örnek talepleri `scripts/review-demo.ts` hazırlar; e-posta ve şifreler yalnızca bilgisayardaki `.env.prod-secrets` dosyasına (`APPLE_REVIEW_*`) yazılır. Apple hesabı silerse ya da dersler eskirse betik yeniden çalıştırılır. Uygulama yayına çıktıktan sonra demo eğitmenin dersleri programdan kaldırılmalı; gerçek üyeler de bu dersleri görür.

## İnceleme öncesi kontrol listesi

- [ ] Canlıda bir demo üye ve bir demo eğitmen hesabı açıldı (şifreleri yalnızca App Store Connect'e yazılır).
- [ ] Demo eğitmen önümüzdeki 4 hafta için hafta içi her gün en az iki ders açtı ("Her hafta tekrarla"); inceleme uzarsa ya da ret sonrası yeniden gönderilirse de ders olur.
- [ ] Demo üyenin en az bir onaylı ve bir onay bekleyen rezervasyonu var; Rezervasyonlarım ve Talepler boş görünmüyor.
- [ ] Apple inceleme sırasında demo hesabı silebilir; inceleme sonrası hesap gerekiyorsa yeniden açılır.
- [x] Ekran görüntüleri App Store Connect'in istediği 6,3 inç (1206 × 2622) boyutunda `docs/ekran-goruntuleri/` klasöründe (karşılama, ders programı, ders detayı, rezervasyonlarım, sabit saatler, stüdyo, eğitmen özeti, talepler). İçerik demo hesaplardan; gerçek üye bilgisi görünmez.
- [ ] TestFlight'ta gerçek bir iPhone'da denendi: giriş, talep, takvime ekleme, iptal, sabit saat, hesabı silme (atılabilir bir hesapla).
- [ ] Telefon bildirimi gerçek iPhone'da geldi: Ayarlar › Bildirimler › "Bildirimleri Aç", sonra bir talep onaylandı ve bildirim düştü.
- [ ] App Store Connect'te gizlilik formu bu dosyadaki tabloyla aynı; gizlilik ve destek adresleri açılıyor.
- [ ] Uygulamadaki fotoğrafların (kala çiçeği, stüdyo, eğitmen) kullanım hakkı var; "üçüncü taraf içerik" sorusu buna göre yanıtlandı.
- [ ] İnceleme için 1.0 (3) ya da daha yeni bir sürüm seçildi.
