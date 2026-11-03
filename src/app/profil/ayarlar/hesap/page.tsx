import { DeleteAccountForm } from "@/components/flowly/forms";
import { ShareDataButton } from "@/components/flowly/native";
import { AppShell } from "@/components/flowly/shell";
import { TrainerDeleteAccountForm } from "@/components/flowly/trainer-account";
import { TopBar } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";
import { trainerDeletionImpact } from "@/lib/queries";
import { isNativeApp } from "@/lib/request";

export const metadata = { title: "Verilerim ve hesap" };

export default async function AccountPage() {
  const user = await requireUser({ next: "/profil/ayarlar/hesap" });
  // The app's web view cannot download files, so it hands the export to the share sheet instead.
  const inApp = await isNativeApp();
  return <AppShell className="settings-screen" nav={false}>
    <TopBar back="/profil/ayarlar" title="Verilerim ve hesap"/>
    <section>
      <h2>Verilerim</h2>
      <p className="muted-note">Hakkında tutulan bütün bilgileri (profil, rezervasyonlar, notlar, yorumlar, bildirimler) tek dosya olarak indir. <a href="/gizlilik">Aydınlatma metni</a></p>
      {inApp ? <ShareDataButton/> : <a href="/profil/verilerim" className="flowly-button is-outline" download>Verilerimi İndir</a>}
      <h2>Hesabı sil</h2>
      {user.role === "member" ? <DeleteAccountForm/> : <TrainerDeleteAccountForm {...await trainerDeletionImpact(user.id)}/>}
    </section>
  </AppShell>;
}
