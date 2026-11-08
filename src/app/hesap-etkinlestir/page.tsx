import type { Metadata } from "next";
import Link from "next/link";
import { ActivateForm } from "@/components/flowly/forms";
import { FlowlyIcon } from "@/components/flowly/icons";
import { AppShell } from "@/components/flowly/shell";
import { Brand, ButtonLink, FloatingFlowers, TopBar } from "@/components/flowly/ui";
import { findInvite } from "@/lib/invites";
import { studio } from "@/lib/studio";

export const metadata: Metadata = { title: "Hesabını etkinleştir", robots: { index: false, follow: false } };

/** Where the studio's invite e-mail leads: the member chooses a password for the account opened for them. */
export default async function ActivatePage({ searchParams }: PageProps<"/hesap-etkinlestir">) {
  const { token } = await searchParams;
  const invite = typeof token === "string" ? await findInvite(token) : null;
  return <AppShell bare className="auth-screen signup-screen activate-screen">
    <FloatingFlowers focus="left"/>
    <TopBar action={<Link href="/" aria-label="Flowly ana sayfa"><Brand/></Link>}/>
    <section>
      {invite && typeof token === "string" ? <>
        <h1>Hoş geldin,<br/>{invite.name.split(" ")[0]}.</h1>
        <p>{studio.name} senin için bir hesap açtı. Şifreni belirle; ders programını görüp birkaç dokunuşla yerini ayırabilirsin.</p>
        <div className="google-account"><FlowlyIcon name="mail" size={20}/><span><small>Giriş e-postan</small>{invite.email}</span></div>
        <ActivateForm token={token} email={invite.email}/>
      </> : <>
        <h1>Bağlantı<br/>geçersiz.</h1>
        <p>Bu davet bağlantısının süresi dolmuş ya da daha önce kullanılmış. Hesabını etkinleştirdiysen giriş yapabilirsin; şifreni hatırlamıyorsan yeni bir bağlantı iste.</p>
        <ButtonLink href="/giris">Giriş Yap</ButtonLink>
        <Link href="/sifre-sifirlama" className="center-link">Yeni bağlantı iste</Link>
      </>}
    </section>
  </AppShell>;
}
