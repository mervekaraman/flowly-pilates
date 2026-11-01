import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/flowly/forms";
import { GoogleButton, googleNotices } from "@/components/flowly/google";
import { AppShell } from "@/components/flowly/shell";
import { Brand, FloatingFlowers, Notice, TopBar } from "@/components/flowly/ui";
import { isGoogleConfigured } from "@/lib/auth/google";
import { getCurrentUser, homeFor, safeNext } from "@/lib/dal";
import { isNativeApp } from "@/lib/request";

export const metadata = { title: "Giriş yap" };

export default async function LoginPage({ searchParams }: PageProps<"/giris">) {
  const params = await searchParams;
  const next = safeNext(params.sonra as string | undefined) ?? undefined;
  const user = await getCurrentUser();
  if (user) redirect(next ?? homeFor(user));
  // Google refuses to show its sign-in page inside an app's web view, so the app offers e-mail only.
  const showGoogle = isGoogleConfigured() && !(await isNativeApp());
  return <AppShell bare className="auth-screen login-screen">
    <FloatingFlowers focus="right"/>
    <TopBar back="/" action={<Link href="/" aria-label="Flowly ana sayfa"><Brand/></Link>}/>
    <section>
      <h1>Tekrar<br/>hoş geldin.</h1>
      <p>{next ? "Devam etmek için hesabına giriş yap." : "Rezervasyonlarını görmek için hesabına giriş yap."}</p>
      {params.silindi === "1" && <Notice tone="success">Hesabın ve tüm verilerin silindi. Seni yeniden görmek isteriz.</Notice>}
      {typeof params.google === "string" && googleNotices[params.google] && <Notice tone={params.google === "iptal" ? "neutral" : "error"}>{googleNotices[params.google]}</Notice>}
      {showGoogle && <GoogleButton next={next}/>}
      <LoginForm next={next}/>
      <div className="auth-switch"><span>Hesabın yok mu?</span><Link href={next ? `/uye-ol?sonra=${encodeURIComponent(next)}` : "/uye-ol"}>Üye Ol</Link></div>
    </section>
  </AppShell>;
}
