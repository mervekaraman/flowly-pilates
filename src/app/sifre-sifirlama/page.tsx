import Link from "next/link";
import { ResetRequestForm } from "@/components/flowly/forms";
import { AppShell } from "@/components/flowly/shell";
import { Brand, TopBar } from "@/components/flowly/ui";
import { isMailConfigured } from "@/lib/mail";

export const metadata = { title: "Şifre yenile" };

export default function ResetRequestPage() {
  return <AppShell bare className="auth-screen reset-screen">
    <TopBar back="/giris" action={<Link href="/" aria-label="Flowly ana sayfa"><Brand/></Link>}/>
    <section>
      <h1>Şifreni<br/>yenile.</h1>
      <p>Hesabına kayıtlı e-posta adresini yaz; şifreni yenilemen için bir bağlantı gönderelim.</p>
      <ResetRequestForm/>
      <Link href="/giris" className="center-link">Girişe dön</Link>
      {!isMailConfigured() && process.env.NODE_ENV !== "production" && <p className="dev-note">Geliştirme modu: e-posta sunucusu ayarlı olmadığı için bağlantı <Link href="/gelistirici/e-postalar">giden e-postalar</Link> sayfasında görünür.</p>}
    </section>
  </AppShell>;
}
