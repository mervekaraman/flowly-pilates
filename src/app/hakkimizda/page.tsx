import Link from "next/link";
import { StudioGallery } from "@/components/flowly/gallery";
import { FlowlyIcon } from "@/components/flowly/icons";
import { LessonRow } from "@/components/flowly/lessons";
import { AppShell } from "@/components/flowly/shell";
import { Avatar, ButtonLink, EmptyState, Rating, SectionTitle, SeeAll, Stars } from "@/components/flowly/ui";
import { getCurrentUser } from "@/lib/dal";
import { fromNow } from "@/lib/format";
import { listLessons, listTrainers, reviewSummary } from "@/lib/queries";
import { studio } from "@/lib/studio";

export const metadata = { title: "Hakkımızda" };

const principles = [
  { icon: "mat" as const, title: "Sadece reformer", text: "Tüm derslerimiz reformer aletiyle, kontrollü ve nefesle uyumlu ilerler." },
  { icon: "users" as const, title: "Küçük gruplar", text: "Gruplar en fazla birkaç kişiden oluşur; eğitmen herkese ayrı ayrı eşlik eder." },
  { icon: "level" as const, title: "Seviyene göre", text: "Başlangıçtan ileri seviyeye kadar, her dersin seviyesi programda açıkça yazar." },
];

const gallery = [
  { src: "/images/flowly/studio-gallery-1.jpg", alt: "Reformer ve kule aletleriyle ders salonu" },
  { src: "/images/flowly/studio-gallery-2.jpg", alt: "Toplar, matlar ve küçük ekipman rafı" },
];

export default async function AboutPage() {
  const user = await getCurrentUser();
  const [trainers, summary, upcoming] = await Promise.all([
    listTrainers(), reviewSummary(),
    listLessons({ from: fromNow(), to: fromNow(7), viewerId: user?.role === "member" ? user.id : undefined }),
  ]);
  const contact = [
    studio.address && { icon: "pin" as const, label: "Adres", value: studio.address },
    studio.phone && { icon: "phone" as const, label: "Telefon", value: studio.phone, href: `tel:${studio.phone.replace(/\s/g, "")}` },
    studio.email && { icon: "mail" as const, label: "E-posta", value: studio.email, href: `mailto:${studio.email}` },
    studio.instagram && { icon: "share" as const, label: "Instagram", value: `@${studio.instagram.replace(/^@/, "")}`, href: `https://instagram.com/${studio.instagram.replace(/^@/, "")}` },
  ].filter(Boolean) as { icon: "pin" | "phone" | "mail" | "share"; label: string; value: string; href?: string }[];

  return <AppShell className="about-screen">
    <div className="studio-hero about-hero" role="img" aria-label={`${studio.name} reformer salonu`}/>
    <section>
      <div className="about-intro">
        <p className="eyebrow">Hakkımızda</p>
        <div className="studio-title"><h1>{studio.name}</h1>{summary.count > 0 && <Link href="/yorumlar"><Rating value={summary.average} count={summary.count}/></Link>}</div>
        <p className="about-lead">{studio.description}</p>
        <div className="tag-row"><span>Reformer</span><span>Küçük grup</span><span>Eğitmen eşliğinde</span><span>{studio.openDaysLabel}</span></div>
        <div className="principles">{principles.map((item) => <div key={item.title}><FlowlyIcon name={item.icon}/><strong>{item.title}</strong><p>{item.text}</p></div>)}</div>
      </div>
      <aside className="side-card">
        <SectionTitle title="Bu haftanın dersleri" action={<SeeAll href="/dersler">Program</SeeAll>}/>
        {upcoming.length ? <div className="lesson-list is-compact">{upcoming.slice(0, 4).map((lesson) => <LessonRow key={lesson.id} lesson={lesson} href={`/dersler/${lesson.id}`}/>)}</div> : <p className="muted-note">Bu hafta için henüz ders açılmadı.</p>}
        <ButtonLink href="/dersler">Ders Programını Gör</ButtonLink>
      </aside>
    </section>

    <section className="about-section" id="studyo">
      <SectionTitle title="Stüdyodan kareler"/>
      <StudioGallery photos={gallery}/>
    </section>

    <section className="about-section" id="egitmenler">
      <SectionTitle title="Eğitmenlerimiz"/>
      {trainers.length ? <div className="trainer-grid">{trainers.map((trainer) => <Link key={trainer.id} href={`/egitmen/${trainer.id}`} className="trainer-card">
        <Avatar name={trainer.name} src={trainer.avatarUrl} size={96}/>
        <div><strong>{trainer.name}</strong><span>Reformer eğitmeni</span><Rating value={trainer.rating} count={trainer.reviewCount || undefined}/></div>
        {trainer.bio && <p>{trainer.bio}</p>}
        <span className="see-all">Profili ve dersleri<FlowlyIcon name="arrow-right" size={15}/></span>
      </Link>)}</div> : <EmptyState icon="user" title="Eğitmen bilgileri yakında burada."/>}
    </section>

    <section className="about-section">
      <SectionTitle title="Üyelerimizin puanı" action={summary.count > 0 ? <SeeAll href="/yorumlar">Ayrıntılar</SeeAll> : undefined}/>
      {summary.count > 0 ? <div className="rating-overview"><strong>{summary.average?.toFixed(1)}</strong><div><Stars value={Math.round(summary.average ?? 0)}/><span>{summary.count} değerlendirme · derslerin ardından üyelerimiz puanlıyor</span></div></div>
        : <p className="muted-note">İlk puanlar derslerin ardından burada görünecek.</p>}
    </section>

    <section className="about-section about-contact">
      <SectionTitle title="Ziyaret ve iletişim"/>
      <div className="contact-grid">
        <div className="contact-item"><FlowlyIcon name="calendar"/><span>Ders günleri</span><strong>{studio.openDaysLabel}</strong></div>
        <div className="contact-item"><FlowlyIcon name="document"/><span>İptal</span><strong>Ders saatinden {studio.cancellationHours} saat öncesine kadar</strong></div>
        {contact.map((item) => item.href
          ? <a key={item.label} href={item.href} className="contact-item" target={item.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer"><FlowlyIcon name={item.icon}/><span>{item.label}</span><strong>{item.value}</strong></a>
          : <div key={item.label} className="contact-item"><FlowlyIcon name={item.icon}/><span>{item.label}</span><strong>{item.value}</strong></div>)}
        <Link href="/yardim" className="contact-item"><FlowlyIcon name="help"/><span>Sorun mu var?</span><strong>Sık sorulan sorular</strong></Link>
      </div>
    </section>
  </AppShell>;
}
