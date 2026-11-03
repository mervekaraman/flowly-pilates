import { ProfileForm } from "@/components/flowly/forms";
import { AppShell } from "@/components/flowly/shell";
import { TopBar } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";
import { formatPhone } from "@/lib/forms";

export const metadata = { title: "Kişisel bilgiler" };

export default async function PersonalInfoPage() {
  const user = await requireUser({ next: "/profil/ayarlar/bilgiler" });
  return <AppShell className="settings-screen" nav={false}>
    <TopBar back="/profil/ayarlar" title="Kişisel bilgiler"/>
    <section>
      <ProfileForm name={user.name} phone={formatPhone(user.phone)} email={user.email}/>
    </section>
  </AppShell>;
}
