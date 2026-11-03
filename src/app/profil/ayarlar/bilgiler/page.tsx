import { ProfileForm } from "@/components/flowly/forms";
import { AppShell } from "@/components/flowly/shell";
import { Avatar, TopBar } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";
import { formatPhone } from "@/lib/forms";

export const metadata = { title: "Kişisel bilgiler" };

export default async function PersonalInfoPage() {
  const user = await requireUser({ next: "/profil/ayarlar/bilgiler" });
  return <AppShell className="settings-screen" nav={false}>
    <TopBar back="/profil/ayarlar" title="Kişisel bilgiler"/>
    <section>
      <div className="edit-photo"><Avatar name={user.name} src={user.avatarUrl} size={96}/><p className="muted-note">Profil fotoğrafını stüdyo ekler.</p></div>
      <ProfileForm name={user.name} phone={formatPhone(user.phone)} email={user.email}/>
    </section>
  </AppShell>;
}
