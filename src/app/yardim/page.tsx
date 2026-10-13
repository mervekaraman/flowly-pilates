import Link from "next/link";
import { FlowlyIcon } from "@/components/flowly/icons";
import { AppShell } from "@/components/flowly/shell";
import { ButtonLink, PageHeading } from "@/components/flowly/ui";
import { studio } from "@/lib/studio";

export const metadata = { title: "Yardım" };

const groups: { title: string; items: [string, React.ReactNode][] }[] = [
  {
    title: "Rezervasyon",
    items: [
      ["Nasıl rezervasyon yaparım?", <>Ders programından günü ve saati seç, ders sayfasında <strong>Rezervasyon talebi gönder</strong>&apos;e bas. Talebin, eğitmen karar verene kadar senin için bir yer tutar.</>],
      ["Talebim ne zaman kesinleşir?", "Eğitmen talebini onayladığında rezervasyonun kesinleşir ve sana e-posta gelir. Durumu her zaman Rezervasyonlarım sayfasından da görebilirsin."],
      ["Ders dolu görünüyor, ne yapabilirim?", "Ders sayfasından bekleme listesine katıl; bir yer açılınca sana bildirim ve e-postayla haber veririz, ilk talep gönderen yeri alır. Dolu derslerde onay bekleyen talepler de yer tutar."],
      ["Derse gelmeden önce hatırlatma gelir mi?", "Evet. Onaylı dersinden bir gün önce akşam e-posta ve bildirim gönderiyoruz. Onay e-postasındaki takvim davetiyle dersi takvimine de ekleyebilirsin."],
      ["Ödemeyi nasıl yapıyorum?", "Ödemeni üyeliğinin başında toplu olarak yaparsın; dersler için ayrıca ücret ödenmez. Uygulama ödeme almaz, kart bilgisi istemez."],
    ],
  },
  {
    title: "İptal ve değişiklik",
    items: [
      ["Rezervasyonumu iptal edebilir miyim?", `Evet. Onaylanmış bir derse ${studio.cancellationHours} saat kalana kadar Rezervasyonlarım sayfasından iptal edebilirsin. Onay bekleyen taleplerini ders başlayana kadar geri çekebilirsin.`],
      [`${studio.cancellationHours} saatten az kaldıysa ne olur?`, "Çevrimiçi iptal kapanır. Gelemeyeceksen lütfen stüdyoya doğrudan haber ver; yerin başka bir üyeye açılabilir."],
      ["Ders iptal olursa?", "Eğitmen bir dersi iptal ederse rezervasyonun otomatik olarak kaldırılır ve sana e-postayla haber verilir. Programdan başka bir saat seçebilirsin."],
    ],
  },
  {
    title: "Ders ve hazırlık",
    items: [
      ["Hangi seviyeyi seçmeliyim?", "Reformer'a yeniysen Başlangıç ya da Tüm seviyeler derslerinden başla. Eğitmenin, ilk dersinden sonra sana uygun seviyeyi önerir."],
      ["Derse ne getirmeliyim?", "Rahat, vücudu saran kıyafetler ve kaymaz pilates çorabı yeterli. Derse 10 dakika erken gelirsen aleti birlikte ayarlarsınız."],
      ["Sağlık durumumu nasıl bildiririm?", "Rezervasyon talebine eklediğin not yalnızca eğitmenine gider; bunun için formdaki açık rıza kutusunu işaretlemen gerekir. Bel, boyun, hamilelik gibi durumları yazman güvenli çalışman için önemli. Notlar dersten 6 ay sonra silinir."],
    ],
  },
  {
    title: "Hesap",
    items: [
      ["Şifremi unuttum.", <>Giriş ekranındaki <Link href="/sifre-sifirlama">Şifremi unuttum</Link> bağlantısından e-posta adresine yenileme bağlantısı isteyebilirsin.</>],
      ["E-posta bildirimlerini kapatabilir miyim?", <><Link href="/profil/ayarlar">Profil ayarlarından</Link> rezervasyon e-postalarını kapatabilirsin. Uygulama içi bildirimler her zaman açık kalır.</>],
      ["Eğitmen hesabı nasıl açılır?", "Eğitmenler, kayıt formunda stüdyonun verdiği davet kodunu girerek hesap açar."],
    ],
  },
];

export default function HelpPage() {
  const contact = [studio.phone && { label: "Telefon", value: studio.phone, href: `tel:${studio.phone.replace(/\s/g, "")}` }, studio.email && { label: "E-posta", value: studio.email, href: `mailto:${studio.email}` }].filter(Boolean) as { label: string; value: string; href: string }[];
  return <AppShell className="help-screen">
    <section>
      <PageHeading eyebrow="Yardım" title="Sık sorulan sorular" sub={`${studio.name} rezervasyonları hakkında merak ettiklerin.`}/>
      <Link href="/rehber" className="guide-link"><FlowlyIcon name="document"/><span><strong>Uygulamayı adım adım öğren</strong>Ders seçmekten iptale kısa bir rehber.</span><FlowlyIcon name="chevron-right" size={18}/></Link>
      <div className="faq">{groups.map((group) => <div key={group.title} className="faq-group">
        <h2>{group.title}</h2>
        {group.items.map(([question, answer]) => <details key={question}><summary>{question}<FlowlyIcon name="plus" size={18}/></summary><div className="faq-answer">{answer}</div></details>)}
      </div>)}</div>
      <div className="side-card help-contact">
        <h2>Cevabını bulamadın mı?</h2>
        {contact.length ? <><p>Stüdyoya doğrudan ulaşabilirsin.</p><div className="contact-links">{contact.map((item) => <a key={item.label} href={item.href} className="see-all">{item.label}: {item.value}<FlowlyIcon name="arrow-right" size={15}/></a>)}</div></>
          : <p>Ders öncesinde ya da sonrasında stüdyodaki ekibimize sorabilirsin; rezervasyonla ilgili notlarını talebine de ekleyebilirsin.</p>}
        <ButtonLink href="/dersler" variant="outline">Ders Programına Git</ButtonLink>
      </div>
    </section>
  </AppShell>;
}
