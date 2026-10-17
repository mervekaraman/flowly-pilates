import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { DeleteAccountForm, EmailChangeForm, PasswordForm, ProfileForm } from "@/components/flowly/forms";
import { PushSettings } from "@/components/flowly/push";
import { AppShell } from "@/components/flowly/shell";
import { Avatar, TopBar } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";
import { formatPhone } from "@/lib/forms";
import { pushPublicKey } from "@/lib/push";

export const metadata = { title: "Profil ve ayarlar" };

export default async function SettingsPage() {
  const user = await requireUser({ next: "/profil/ayarlar" });
  const publicKey = pushPublicKey();
  const [account] = await (await getDb()).select({ passwordSet: users.passwordSet, google: users.googleSub }).from(users).where(eq(users.id, user.id)).limit(1);
  const hasPassword = account?.passwordSet ?? true;
  return <AppShell className="settings-screen" nav={false}>
    <TopBar back="/profil" title="Profil ve ayarlar"/>
    <section>
      <div className="edit-photo"><Avatar name={user.name} src={user.avatarUrl} size={112}/><p className="muted-note">Profil fotoğrafını stüdyo ekler.</p></div>
      <div className="settings-columns">
        <div><h2>Kişisel bilgiler</h2><ProfileForm name={user.name} phone={formatPhone(user.phone)} email={user.email} emailNotifications={user.emailNotifications}/></div>
        <div>
          {publicKey && <><h2>Bildirimler</h2><PushSettings publicKey={publicKey}/></>}
          <h2>Şifre</h2>
          {account?.google && <p className="muted-note">Hesabın Google&apos;a bağlı; giriş sayfasında “Google ile devam et”i kullanabilirsin.{hasPassword ? "" : " İstersen e-posta ve şifreyle girmek için bir şifre de belirle."}</p>}
          <PasswordForm hasPassword={hasPassword}/>
          <h2>E-posta adresi</h2><p className="muted-note">Şu anki adresin: {user.email}. Yeni adrese bir onay bağlantısı göndeririz; bağlantıyı açınca değişir.</p><EmailChangeForm/>
          <h2>Verilerim</h2><p className="muted-note">Hakkında tutulan bütün bilgileri (profil, rezervasyonlar, notlar, yorumlar, bildirimler) tek dosya olarak indir. <a href="/gizlilik">Aydınlatma metni</a></p><a href="/profil/verilerim" className="flowly-button is-outline" download>Verilerimi İndir</a>
          <h2>Hesabı sil</h2>
          {user.role === "member" ? <DeleteAccountForm/> : <p className="muted-note">Eğitmen hesapları, açılmış dersler ve üye kayıtları korunsun diye stüdyo üzerinden kapatılır.</p>}
        </div>
      </div>
    </section>
  </AppShell>;
}
