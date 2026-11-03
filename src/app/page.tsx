import Link from "next/link";
import { FlowlyIcon } from "@/components/flowly/icons";
import { LightStatusBar } from "@/components/flowly/native";
import { SiteHeader } from "@/components/flowly/nav";
import { Brand, FloatingFlowers } from "@/components/flowly/ui";
import { getCurrentUser } from "@/lib/dal";
import { unreadCount } from "@/lib/queries";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) return <Welcome/>;
  const unread = await unreadCount(user.id);
  const primary = user.role === "trainer" ? { href: "/egitmen-paneli", label: "Eğitmen Paneli" } : { href: "/rezervasyonlar", label: "Rezervasyonlarım" };
  return <main className="home-screen">
    <FloatingFlowers/>
    <SiteHeader variant={user.role} user={{ name: user.name, avatarUrl: user.avatarUrl }} unread={unread}/>
    <section className="home-hero">
      <p className="home-eyebrow" lang="en">Pilates. Nearby. On your terms.</p>
      <h1>Akışını yönet.</h1>
      <p className="home-lead">Dersini seç, rezervasyonunu görüntüle ve planın değiştiğinde kolayca güncelle.</p>
      <Link href={primary.href} className="home-cta">{primary.label}<FlowlyIcon name="arrow-right" size={20}/></Link>
      <Link href="/dersler" className="home-secondary">Ders programını gör</Link>
    </section>
  </main>;
}

/** First screen for visitors: the calla photo edge to edge, the brand in the middle, sign-up at the bottom. */
function Welcome() {
  return <main className="welcome-screen">
    <LightStatusBar/>
    <div className="welcome-photo"/>
    <div className="welcome-logo"><Brand light/><p lang="en">Pilates. Nearby.<br/>On your terms.</p></div>
    <div className="welcome-actions">
      <p>Reformer derslerini gör, yerini birkaç dokunuşla ayır.</p>
      <Link href="/uye-ol" className="welcome-primary">Üye ol<FlowlyIcon name="arrow-right" size={20}/></Link>
      <Link href="/giris" className="welcome-secondary">Giriş yap</Link>
      <Link href="/dersler" className="welcome-browse">Önce ders programına göz at</Link>
    </div>
  </main>;
}
