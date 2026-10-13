import Link from "next/link";
import { NewPasswordForm } from "@/components/flowly/forms";
import { AppShell } from "@/components/flowly/shell";
import { Brand, ButtonLink, TopBar } from "@/components/flowly/ui";

export const metadata = { title: "Yeni şifre" };

export default async function NewPasswordPage({ searchParams }: PageProps<"/sifre-sifirlama/yeni">) {
  const { token } = await searchParams;
  return <AppShell bare className="auth-screen reset-screen">
    <TopBar back="/giris" action={<Link href="/" aria-label="Flowly ana sayfa"><Brand/></Link>}/>
    <section>
      {typeof token === "string" && token.length >= 20 ? <>
        <h1>Yeni şifreni<br/>belirle.</h1>
        <p>En az 8 karakterlik, başka yerde kullanmadığın bir şifre seç.</p>
        <NewPasswordForm token={token}/>
      </> : <>
        <h1>Bağlantı<br/>geçersiz.</h1>
        <p>Şifre yenileme bağlantısı eksik ya da hatalı görünüyor. Yeni bir bağlantı isteyebilirsin.</p>
        <ButtonLink href="/sifre-sifirlama">Yeni Bağlantı İste</ButtonLink>
        <Link href="/giris" className="center-link">Girişe dön</Link>
      </>}
    </section>
  </AppShell>;
}
