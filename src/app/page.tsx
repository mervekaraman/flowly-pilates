import type { Viewport } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FlowlyIcon } from "@/components/flowly/icons";
import { LightStatusBar } from "@/components/flowly/native";
import { SiteHeader } from "@/components/flowly/nav";
import { Brand, FloatingFlowers } from "@/components/flowly/ui";
import { getCurrentUser, homeFor } from "@/lib/dal";
import { unreadCount } from "@/lib/queries";
import { isNativeApp } from "@/lib/request";
import { PHOTO_TOP } from "@/lib/photo-colors";

/**
 * Visitors on a phone (and in the app) get the photo welcome screen, so the phone's top bar takes the
 * bordo the photo fades to; on a computer they get the cream landing page, so the bar stays cream.
 */
export async function generateViewport(): Promise<Viewport> {
  if (await getCurrentUser()) return {};
  if (await isNativeApp()) return { themeColor: PHOTO_TOP };
  return { themeColor: [{ media: "(max-width: 1023px)", color: PHOTO_TOP }, { media: "(min-width: 1024px)", color: "#f8f5e8" }] };
}

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) {
    // The app always opens on the photo welcome screen. A browser gets both: the photo screen on
    // phones and tablets, the original cream landing page on a computer (globals.css picks one).
    if (await isNativeApp()) return <Welcome/>;
    return <><div className="welcome-small"><Welcome/></div><div className="landing-large"><Landing user={null} unread={0}/></div></>;
  }
  // The app opens straight into the member's schedule or the trainer's panel; the landing page is for the website.
  if (await isNativeApp()) redirect(homeFor(user));
  return <Landing user={user} unread={await unreadCount(user.id)}/>;
}

type LandingUser = { name: string; avatarUrl: string | null; role: "member" | "trainer" };

/** The website's landing page: floating flowers, the site menu and "Akışını yönet." in the middle. */
function Landing({ user, unread }: { user: LandingUser | null; unread: number }) {
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
