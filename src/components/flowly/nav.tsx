"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlowlyIcon, type FlowlyIconName } from "./icons";
import { Avatar, Brand } from "./ui";

export type NavVariant = "public" | "member" | "trainer";
type NavUser = { name: string; avatarUrl: string | null };

const headerItems: Record<NavVariant, { href: string; label: string }[]> = {
  public: [{ href: "/dersler", label: "Ders Programı" }, { href: "/hakkimizda", label: "Hakkımızda" }, { href: "/yardim", label: "Yardım" }],
  member: [{ href: "/dersler", label: "Ders Programı" }, { href: "/takvim", label: "Takvim" }, { href: "/rezervasyonlar", label: "Rezervasyonlarım" }, { href: "/hakkimizda", label: "Hakkımızda" }, { href: "/yardim", label: "Yardım" }],
  trainer: [{ href: "/egitmen-paneli", label: "Özet" }, { href: "/egitmen-paneli/takvim", label: "Takvim" }, { href: "/egitmen-paneli/talepler", label: "Talepler" }, { href: "/egitmen-paneli/uyeler", label: "Üyeler" }, { href: "/egitmen-paneli/yeni-ders", label: "Yeni Ders" }],
};

const bottomItems: Record<NavVariant, { href: string; label: string; icon: FlowlyIconName }[]> = {
  public: [{ href: "/dersler", label: "Program", icon: "calendar" }, { href: "/hakkimizda", label: "Stüdyo", icon: "studio" }, { href: "/yardim", label: "Yardım", icon: "help" }, { href: "/giris", label: "Giriş", icon: "user" }],
  member: [{ href: "/dersler", label: "Program", icon: "calendar" }, { href: "/takvim", label: "Takvim", icon: "calendar-days" }, { href: "/rezervasyonlar", label: "Rezervasyonlar", icon: "bookmark" }, { href: "/bildirimler", label: "Bildirimler", icon: "bell" }, { href: "/profil", label: "Profil", icon: "user" }],
  trainer: [{ href: "/egitmen-paneli", label: "Özet", icon: "home" }, { href: "/egitmen-paneli/takvim", label: "Takvim", icon: "calendar" }, { href: "/egitmen-paneli/talepler", label: "Talepler", icon: "document" }, { href: "/egitmen-paneli/uyeler", label: "Üyeler", icon: "users" }, { href: "/profil", label: "Profil", icon: "user" }],
};

// Tabs are siblings, so switching between them crossfades instead of sliding (see motion.css).
const tab = ["nav-tab"];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => {
    if (href === "/egitmen-paneli") return pathname === href;
    // A lesson's roster belongs to the calendar it was opened from.
    if (href === "/egitmen-paneli/takvim" && pathname.startsWith("/egitmen-paneli/dersler/")) return true;
    return pathname === href || pathname.startsWith(`${href}/`);
  };
}

export function SiteHeader({ variant, user, unread = 0 }: { variant: NavVariant; user?: NavUser | null; unread?: number }) {
  const isActive = useIsActive();
  return <header className="site-header" style={{ viewTransitionName: "site-header" }}><div className="site-header-inner">
    <Link href="/" aria-label="Flowly ana sayfa" transitionTypes={tab}><Brand/></Link>
    <nav aria-label="Ana menü">{headerItems[variant].map((item) => <Link key={item.href} href={item.href} transitionTypes={tab} className={isActive(item.href) ? "is-active" : ""} aria-current={isActive(item.href) ? "page" : undefined}>{item.label}</Link>)}</nav>
    {variant === "public" || !user
      ? <div className="site-header-actions"><Link href="/giris">Giriş Yap</Link><Link href="/uye-ol" className="site-header-cta">Üye Ol</Link></div>
      : <div className="site-header-actions">
        <Link href="/bildirimler" aria-label={unread ? `Bildirimler, ${unread} okunmamış` : "Bildirimler"} className="site-header-icon"><FlowlyIcon name="bell" size={22}/>{unread > 0 && <i className="unread-dot"/>}</Link>
        <Link href="/profil" aria-label="Profil" className="site-header-avatar"><Avatar name={user.name} src={user.avatarUrl} size={38}/></Link>
      </div>}
  </div></header>;
}

export function BottomNav({ variant, unread = 0 }: { variant: NavVariant; unread?: number }) {
  const isActive = useIsActive();
  return <nav className="flowly-bottom-nav" aria-label="Alt menü" style={{ viewTransitionName: "bottom-nav" }}>{bottomItems[variant].map((item) => <Link key={item.href} href={item.href} transitionTypes={tab} className={isActive(item.href) ? "is-active" : ""} aria-current={isActive(item.href) ? "page" : undefined}><span className="nav-icon"><FlowlyIcon name={item.icon}/>{item.icon === "bell" && unread > 0 && <i className="unread-dot"/>}</span><span>{item.label}</span></Link>)}</nav>;
}
