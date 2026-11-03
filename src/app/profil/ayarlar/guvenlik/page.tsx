import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { EmailChangeForm, PasswordForm } from "@/components/flowly/forms";
import { AppShell } from "@/components/flowly/shell";
import { TopBar } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";
import { isNativeApp } from "@/lib/request";

export const metadata = { title: "Giriş ve güvenlik" };

export default async function SecurityPage() {
  const user = await requireUser({ next: "/profil/ayarlar/guvenlik" });
  const inApp = await isNativeApp();
  const [account] = await (await getDb()).select({ passwordSet: users.passwordSet, google: users.googleSub }).from(users).where(eq(users.id, user.id)).limit(1);
  const hasPassword = account?.passwordSet ?? true;
  return <AppShell className="settings-screen" nav={false}>
    <TopBar back="/profil/ayarlar" title="Giriş ve güvenlik"/>
    <section>
      <h2>Şifre</h2>
      {account?.google && (inApp
        ? !hasPassword && <p className="muted-note">Hesabın Google&apos;a bağlı. Uygulamada e-posta ve şifreyle giriş yapabilmek için burada bir şifre belirle.</p>
        : <p className="muted-note">Hesabın Google&apos;a bağlı; giriş sayfasında “Google ile devam et”i kullanabilirsin.{hasPassword ? "" : " İstersen e-posta ve şifreyle girmek için bir şifre de belirle."}</p>)}
      <PasswordForm hasPassword={hasPassword}/>
      <h2>E-posta adresi</h2>
      <p className="muted-note">Şu anki adresin: {user.email}. Yeni adrese bir onay bağlantısı göndeririz; bağlantıyı açınca değişir.</p>
      <EmailChangeForm/>
    </section>
  </AppShell>;
}
