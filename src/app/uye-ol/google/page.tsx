import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GoogleSignupForm } from "@/components/flowly/forms";
import { AppShell } from "@/components/flowly/shell";
import { Brand, FloatingFlowers, TopBar } from "@/components/flowly/ui";
import { GOOGLE_PENDING_COOKIE, openPendingSignup } from "@/lib/auth/google";
import { getCurrentUser, homeFor } from "@/lib/dal";

export const metadata = { title: "Hesabını tamamla" };

// First Google sign-in: Google gave the name and a verified e-mail; phone and consent come from here.
export default async function GoogleSignupPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user));
  const pending = openPendingSignup((await cookies()).get(GOOGLE_PENDING_COOKIE)?.value);
  if (!pending) redirect("/uye-ol");
  return <AppShell bare className="auth-screen signup-screen">
    <FloatingFlowers focus="left"/>
    <TopBar back="/uye-ol" action={<Link href="/" aria-label="Flowly ana sayfa"><Brand/></Link>}/>
    <section>
      <h1>Son bir<br/>adım.</h1>
      <p>Google hesabınla devam ediyorsun. Ders hatırlatmaları için telefonunu ekle.</p>
      <GoogleSignupForm name={pending.name} email={pending.email}/>
    </section>
  </AppShell>;
}
