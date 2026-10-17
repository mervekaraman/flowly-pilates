import Link from "next/link";
import { AppShell } from "@/components/flowly/shell";
import { PageHeading } from "@/components/flowly/ui";
import { studio } from "@/lib/studio";

export const metadata = { title: "Aydınlatma metni ve kullanım koşulları" };

// KVKK (6698) md. 10 aydınlatma metni. The facts here mirror what the code actually does
// (retention periods in src/lib/jobs.ts, processors in README); keep them in sync when either changes.
export default function PrivacyPage() {
  const controller = studio.legalName || studio.name;
  const kvkkEmail = studio.kvkkEmail || studio.email;
  const contact = [studio.address, kvkkEmail, studio.phone].filter(Boolean).join(" · ");
  return <AppShell className="legal-screen">
    <section>
      <PageHeading eyebrow="KVKK" title="Aydınlatma metni" sub={`${studio.name} rezervasyon uygulamasında kişisel verilerinin nasıl işlendiğini sade bir dille anlatıyoruz.`}/>
      <article className="prose">
        <h2 id="aydinlatma">Veri sorumlusu</h2>
        <p>Kişisel verilerin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında veri sorumlusu sıfatıyla <strong>{controller}</strong> tarafından işlenir.{contact && <> İletişim: {contact}.</>}</p>

        <h2>Hangi verilerini işliyoruz?</h2>
        <ul>
          <li><strong>Kimlik ve iletişim:</strong> ad soyad, e-posta adresi, cep telefonu.</li>
          <li><strong>Rezervasyon bilgileri:</strong> seçtiğin dersler, talep ve iptal kayıtları, derse katılım durumu, verdiğin efor puanları, yorumların ve paylaştığın Spotify çalma listesi bağlantısı.</li>
          <li id="saglik"><strong>Sağlık bilgisi (özel nitelikli veri):</strong> yalnızca rezervasyon notuna kendi isteğinle yazdığın bilgiler (ör. bel hassasiyeti, hamilelik). Bu notlar yalnızca <strong>açık rızanla</strong> kaydedilir, yalnızca dersin eğitmeniyle paylaşılır ve dersten 6 ay sonra otomatik silinir. Rıza vermezsen not yazmadan rezervasyon yapabilirsin; rızanı, notu boş bırakarak ya da hesabını silerek her zaman geri alabilirsin.</li>
          <li><strong>İşlem güvenliği:</strong> oturum kaydı, şifrenin geri döndürülemez özeti (hash) ve kötüye kullanımı önlemek için giriş denemesi sayaçları (IP adresi ve e-posta yalnızca özet olarak tutulur).</li>
          <li><strong>Google ile giriş:</strong> “Google ile devam et”i kullanırsan Google’dan yalnızca adını, doğrulanmış e-posta adresini ve hesabını tanımaya yarayan kimlik numarasını alırız; Google şifrene, kişilerine ya da diğer verilerine erişmeyiz.</li>
          <li><strong>Bildirim tercihi:</strong> telefon bildirimlerini açtıysan, cihazının bildirim servisinin verdiği adres.</li>
        </ul>

        <h2>Hangi amaçla ve hangi hukuki sebeple?</h2>
        <ul>
          <li>Hesabını açmak, rezervasyonlarını oluşturmak ve yönetmek, eğitmenin derse hazırlanabilmesi: sözleşmenin kurulması ve ifası (KVKK md. 5/2-c).</li>
          <li>Talep, onay, iptal, hatırlatma ve “yer açıldı” e-postaları ile uygulama bildirimleri: sözleşmenin ifası (md. 5/2-c).</li>
          <li>Hesap güvenliği, kötüye kullanımın önlenmesi ve yedekleme: meşru menfaat (md. 5/2-f).</li>
          <li>Rezervasyon notundaki sağlık bilgisi: açık rıza (md. 6/2).</li>
          <li>Yorumlar, ad ve soyadının yalnızca baş harfiyle (ör. “Elif Y.”) herkese açık gösterilir; fotoğrafın gösterilmez.</li>
        </ul>

        <h2>Kimlerle paylaşıyoruz?</h2>
        <ul>
          <li><strong>Eğitmenler:</strong> rezervasyon yaptığın dersin eğitmeni adını, iletişim bilgini, notunu, katılımını ve efor puanını görür. Stüdyo eğitmenleri üye listesini görebilir.</li>
          <li><strong>Hizmet sağlayıcılar (veri işleyenler):</strong> uygulamanın barındırıldığı Vercel ve veritabanının bulunduğu Supabase (sunucular Frankfurt, Almanya), e-postaları ileten Google (Gmail) ve telefon bildirimlerini ileten tarayıcı bildirim servisleri (Apple, Google, Mozilla). Bu aktarımlar yurt dışına yapıldığından KVKK md. 9 kapsamında yürütülür.</li>
          <li><strong>WhatsApp:</strong> uygulama WhatsApp’a veri göndermez; eğitmen ya da sen bir WhatsApp butonuna basarsan, mesaj o kişinin kendi telefonundaki WhatsApp’tan gönderilir.</li>
        </ul>
        <p>Verilerin reklam ya da pazarlama amacıyla kimseyle paylaşılmaz, satılmaz.</p>

        <h2>Ne kadar süre saklıyoruz?</h2>
        <ul>
          <li>Hesap bilgileri ve rezervasyon geçmişi: hesabın açık olduğu sürece.</li>
          <li>Rezervasyon notları (sağlık bilgisi dahil): dersten 6 ay sonra silinir.</li>
          <li>Gönderilen e-postaların kopyaları: 30 gün. Şifre sıfırlama ve e-posta onay bağlantıları kopyalarda gizlenir.</li>
          <li>Şifre ve e-posta bağlantıları: 1 saat; oturumlar: 30 gün; okunmuş bildirimler: 1 yıl.</li>
          <li>Şifreli veritabanı yedekleri: 30 gün.</li>
        </ul>

        <h2>Çerezler</h2>
        <p>Yalnızca giriş yaptığını hatırlamak için zorunlu bir oturum çerezi kullanılır. Analiz, reklam ya da takip çerezi kullanılmaz; sayfalara başka sitelerden takip kodu yüklenmez.</p>

        <h2>Hakların (KVKK md. 11)</h2>
        <p>Verilerinin işlenip işlenmediğini öğrenme, bilgi isteme, düzeltilmesini ya da silinmesini isteme, aktarıldığı kişileri bilme, itiraz etme ve zarara uğradıysan giderilmesini talep etme hakların var. Uygulamada:</p>
        <ul>
          <li>Ad, telefon ve e-posta bilgini <Link href="/profil/ayarlar">Profil › Ayarlar</Link>’dan güncelleyebilirsin.</li>
          <li>Hakkında tutulan bütün verileri aynı sayfadan <strong>“Verilerimi indir”</strong> ile dosya olarak alabilirsin.</li>
          <li>Hesabını aynı sayfadan <strong>kalıcı olarak silebilirsin</strong>; hesabın, rezervasyonların, yorumların, bildirimlerin ve sana gönderilen e-postaların kopyaları silinir.</li>
          <li>Diğer talepler için {kvkkEmail ? <a href={`mailto:${kvkkEmail}`}>{kvkkEmail}</a> : "stüdyoya"} başvurabilirsin; en geç 30 gün içinde yanıtlanır.</li>
        </ul>

        <h2 id="kosullar">Kullanım koşulları</h2>
        <ul>
          <li>Rezervasyon talebi, eğitmen onayladığında kesinleşir; onay bekleyen talepler de derste yer tutar.</li>
          <li>Onaylanmış bir dersi, ders saatine {studio.cancellationHours} saat kalana kadar iptal edebilirsin.</li>
          <li>Ödemeler üyelik başında toplu olarak alınır; uygulama üzerinden ödeme alınmaz ve kart bilgisi istenmez.</li>
          <li>Yorumlar gerçek deneyimine dayanmalı; hakaret ya da kişisel bilgi içeren yorumlar kaldırılabilir.</li>
        </ul>
      </article>
    </section>
  </AppShell>;
}
