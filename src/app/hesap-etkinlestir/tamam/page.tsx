import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/flowly/shell";
import { Brand, TopBar } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";
import { isNativeApp } from "@/lib/request";
import { studio } from "@/lib/studio";

export const metadata: Metadata = { title: "Hesabın hazır", robots: { index: false, follow: false } };

/**
 * After activation the member is signed in on this browser. The invite was opened from an e-mail, so
 * this is usually Safari: point iPhone users to the app, everyone else can carry on here.
 */
export default async function ActivatedPage() {
  const user = await requireUser({ next: "/hesap-etkinlestir/tamam" });
  if (await isNativeApp()) redirect("/rehber?ilk=1");
  return <AppShell bare className="auth-screen activated-screen">
    <TopBar action={<Link href="/" aria-label="Flowly ana sayfa"><Brand/></Link>}/>
    <section>
      <Image src="/icons/icon-512.png" alt="" width={96} height={96} className="activated-icon" priority/>
      <h1>Hesabın<br/>hazır.</h1>
      <p>iPhone&apos;una {studio.name} uygulamasını indir ve <strong>{user.email}</strong> adresiyle, yeni şifrenle giriş yap.</p>
      <a href={studio.appStoreUrl} className="flowly-button">App Store&apos;da Aç</a>
      <Link href="/rehber?ilk=1" className="center-link">Web&apos;de devam et</Link>
      <p className="muted-note">Android telefonda ya da bilgisayarda uygulamayı bu siteden kullanabilirsin.</p>
    </section>
  </AppShell>;
}
