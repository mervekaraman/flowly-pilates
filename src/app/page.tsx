import Link from "next/link";
import { FlowlyIcon } from "@/components/flowly/icons";
import { SiteHeader } from "@/components/flowly/nav";
import { FloatingFlowers } from "@/components/flowly/ui";
import { getCurrentUser } from "@/lib/dal";
import { unreadCount } from "@/lib/queries";

export default async function HomePage() {
  const user = await getCurrentUser();
  const unread = user ? await unreadCount(user.id) : 0;
  const primary = user?.role === "trainer" ? { href: "/egitmen-paneli", label: "Eğitmen Paneli" } : { href: "/rezervasyonlar", label: "Rezervasyonlarım" };
  return <main className="home-screen">
    <FloatingFlowers/>
    <SiteHeader variant={user?.role ?? "public"} user={user ? { name: user.name, avatarUrl: user.avatarUrl } : null} unread={unread}/>
    <section className="home-hero">
      <p className="home-eyebrow" lang="en">Pilates. Nearby. On your terms.</p>
      <h1>Akışını yönet.</h1>
      <p className="home-lead">Dersini seç, rezervasyonunu görüntüle ve planın değiştiğinde kolayca güncelle.</p>
      <Link href={primary.href} className="home-cta">{primary.label}<FlowlyIcon name="arrow-right" size={20}/></Link>
      <Link href="/dersler" className="home-secondary">Ders programını gör</Link>
    </section>
  </main>;
}
