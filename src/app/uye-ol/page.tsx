import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/flowly/forms";
import { AppShell } from "@/components/flowly/shell";
import { Brand, FloatingFlowers, TopBar } from "@/components/flowly/ui";
import { getCurrentUser, homeFor, safeNext } from "@/lib/dal";
import { studio } from "@/lib/studio";

export const metadata = { title: "Üye ol" };

export default async function SignupPage({ searchParams }: PageProps<"/uye-ol">) {
  const next = safeNext((await searchParams).sonra as string | undefined) ?? undefined;
  const user = await getCurrentUser();
  if (user) redirect(next ?? homeFor(user));
  return <AppShell bare className="auth-screen signup-screen">
    <FloatingFlowers focus="left"/>
    <TopBar back="/" action={<Link href="/" aria-label="Flowly ana sayfa"><Brand/></Link>}/>
    <section>
      <h1>Aramıza<br/>katıl.</h1>
      <p>{studio.name}&apos;te reformer derslerine yerini ayırmak için hesabını oluştur.</p>
      <SignupForm next={next}/>
      <div className="auth-switch"><span>Zaten hesabın var mı?</span><Link href={next ? `/giris?sonra=${encodeURIComponent(next)}` : "/giris"}>Giriş Yap</Link></div>
    </section>
  </AppShell>;
}
