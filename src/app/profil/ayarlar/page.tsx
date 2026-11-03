import Link from "next/link";
import { FlowlyIcon, type FlowlyIconName } from "@/components/flowly/icons";
import { AppShell } from "@/components/flowly/shell";
import { TopBar } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";

export const metadata = { title: "Ayarlar" };

/** Settings menu: one short row per area, each opening its own page, so nothing needs long scrolling. */
const sections: [FlowlyIconName, string, string, string][] = [
  ["user", "Kişisel bilgiler", "Ad, telefon", "/profil/ayarlar/bilgiler"],
  ["bell", "Bildirimler", "E-posta ve telefon bildirimleri", "/profil/ayarlar/bildirimler"],
  ["lock", "Giriş ve güvenlik", "Şifre, e-posta adresi", "/profil/ayarlar/guvenlik"],
  ["document", "Verilerim ve hesap", "Verileri indir, hesabı sil", "/profil/ayarlar/hesap"],
];

export default async function SettingsPage() {
  const user = await requireUser({ next: "/profil/ayarlar" });
  return <AppShell className="settings-screen" nav={false}>
    <TopBar back="/profil" title="Ayarlar"/>
    <section>
      <div className="settings-head"><strong>{user.name}</strong><span>{user.email}</span></div>
      <nav className="settings-menu" aria-label="Ayarlar">{sections.map(([icon, title, hint, href]) => <Link key={href} href={href} className="setting-row">
        <FlowlyIcon name={icon}/><span><strong>{title}</strong><small>{hint}</small></span><span/><FlowlyIcon name="chevron-right" size={18}/>
      </Link>)}</nav>
    </section>
  </AppShell>;
}
