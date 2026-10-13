import Link from "next/link";
import { FlowlyIcon, type FlowlyIconName } from "@/components/flowly/icons";
import { LogoutButton } from "@/components/flowly/push";
import { AppShell } from "@/components/flowly/shell";
import { Avatar, Brand, SeeAll } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";
import { startOfWeek, todayKey } from "@/lib/format";
import { formatPhone } from "@/lib/forms";
import { memberStats, trainerStats } from "@/lib/queries";

export const metadata = { title: "Profil" };

export default async function ProfilePage() {
  const user = await requireUser({ next: "/profil" });
  const trainer = user.role === "trainer";
  const stats = trainer
    ? await trainerStats(user.id, startOfWeek(todayKey())).then((s) => [[s.weekLessons, "Bu hafta ders"], [s.weekParticipants, "Katılımcı"], [s.pending, "Bekleyen talep"]] as const)
    : await memberStats(user.id).then((s) => [[s.completed, "Tamamlanan"], [s.upcoming, "Yaklaşan"], [s.reviews, "Yorum"]] as const);
  const links: [FlowlyIconName, string, string][] = trainer
    ? [["home", "Eğitmen paneli", "/egitmen-paneli"], ["calendar", "Ders takvimi", "/egitmen-paneli/takvim"], ["bell", "Bildirimler", "/bildirimler"], ["document", "Nasıl kullanılır?", "/rehber"], ["help", "Yardım", "/yardim"]]
    : [["bookmark", "Rezervasyonlarım", "/rezervasyonlar"], ["star", "Yorumlar", "/yorumlar"], ["bell", "Bildirimler", "/bildirimler"], ["document", "Nasıl kullanılır?", "/rehber"], ["help", "Yardım", "/yardim"]];

  return <AppShell className="profile-screen">
    <header className="brand-action"><Brand/><Link href="/profil/ayarlar" aria-label="Ayarlar"><FlowlyIcon name="settings" size={26}/></Link></header>
    <section>
      <div className="profile-hero">
        <Avatar name={user.name} src={user.avatarUrl} size={128}/>
        <div>
          <p className="eyebrow">{trainer ? "Eğitmen" : "Üye"}</p>
          <h1>{user.name}</h1>
          <p>{user.email}</p>
          {user.phone && <p>{formatPhone(user.phone)}</p>}
          <SeeAll href="/profil/ayarlar">Profili düzenle</SeeAll>
        </div>
      </div>
      <div className="profile-stats">{stats.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
      <div className="profile-side">
        <div className="settings-list">{links.map(([icon, label, href]) => <Link key={href} href={href} className="setting-row"><FlowlyIcon name={icon}/><strong>{label}</strong><span/><FlowlyIcon name="chevron-right" size={18}/></Link>)}</div>
        <LogoutButton/>
      </div>
    </section>
  </AppShell>;
}
