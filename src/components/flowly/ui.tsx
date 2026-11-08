/* eslint-disable @next/next/no-img-element -- Avatars and studio photos are small local files with fixed crops. */
import Link from "next/link";
import { initials } from "@/lib/format";
import { FlowlyIcon, type FlowlyIconName } from "./icons";

// Presentational building blocks. No hooks here, so they render in Server and Client Components alike.

export function Brand({ light = false }: { light?: boolean }) { return <span className={`flowly-brand${light ? " is-light" : ""}`}>flowly</span>; }

export function ButtonLink({ href, children, variant = "primary", icon = true }: { href: string; children: React.ReactNode; variant?: "primary" | "outline"; icon?: boolean }) {
  return <Link href={href} className={`flowly-button${variant === "outline" ? " is-outline" : ""}`}>{children}{icon && <FlowlyIcon name="arrow-right" size={20}/>}</Link>;
}

/** Opens WhatsApp with the member's number and a prepared message (free; the trainer presses send). */
export function WhatsAppLink({ href, children = "WhatsApp'tan haber ver", variant = "inline" }: { href: string | null; children?: React.ReactNode; variant?: "inline" | "button" }) {
  if (!href) return null;
  return <a href={href} target="_blank" rel="noopener noreferrer" className={variant === "button" ? "flowly-button is-outline whatsapp-button" : "whatsapp-link"}><FlowlyIcon name="chat" size={variant === "button" ? 20 : 16}/>{children}</a>;
}

export function TopBar({ title, back, action }: { title?: string; back?: string; action?: React.ReactNode }) {
  return <header className="flowly-topbar">{back ? <Link href={back} transitionTypes={["nav-back"]} className="icon-button" aria-label="Geri"><FlowlyIcon name="arrow-left" size={28}/></Link> : <span/>}<strong>{title}</strong><div>{action}</div></header>;
}

export function StatusBadge({ children, tone = "moss", dot = false }: { children: React.ReactNode; tone?: "moss" | "plum" | "blue" | "neutral"; dot?: boolean }) {
  return <span className={`status-badge ${tone}`}>{dot && <i className="status-dot"/>}{children}</span>;
}

export const bookingTone = { pending: "blue", approved: "moss", rejected: "plum", cancelled: "neutral" } as const;

export function Rating({ value, count }: { value: number | null; count?: number }) {
  if (value === null) return <span className="rating is-empty">Henüz puan yok</span>;
  return <span className="rating"><FlowlyIcon name="star" size={14}/>{value.toFixed(1)}{count !== undefined && <span>({count})</span>}</span>;
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return <span className="stars" role="img" aria-label={`5 üzerinden ${value}`}>{[1, 2, 3, 4, 5].map((star) => <FlowlyIcon key={star} name="star" size={size} className={star <= value ? "is-on" : ""}/>)}</span>;
}

export function SeeAll({ href, children = "Tümünü gör" }: { href: string; children?: React.ReactNode }) {
  return <Link href={href} className="see-all">{children}<FlowlyIcon name="arrow-right" size={15}/></Link>;
}

export function Avatar({ name, src, size = 48 }: { name: string; src?: string | null; size?: number }) {
  return src
    ? <img className="avatar" src={src} alt="" width={size} height={size} style={{ width: size, height: size }}/>
    : <span className="avatar is-initials" aria-hidden="true" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>{initials(name)}</span>;
}

export function PageHeading({ eyebrow, title, sub, action }: { eyebrow?: string; title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{sub && <p className="page-sub">{sub}</p>}</div>{action}</div>;
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="section-title-row"><h2>{title}</h2>{action}</div>;
}

export function InfoRow({ icon, label, value, href }: { icon: FlowlyIconName; label?: string; value: React.ReactNode; href?: string }) {
  const content = <>{label && <span>{label}</span>}<FlowlyIcon name={icon}/><p>{value}</p>{href && <FlowlyIcon name="chevron-right" size={18}/>}</>;
  return href ? <Link href={href} className="summary-row is-link">{content}</Link> : <div className="summary-row">{content}</div>;
}

export function EmptyState({ icon, title, text, action }: { icon: FlowlyIconName; title: string; text?: string; action?: React.ReactNode }) {
  return <div className="empty-state"><FlowlyIcon name={icon} size={36}/><h2>{title}</h2>{text && <p>{text}</p>}{action}</div>;
}

export function Notice({ tone = "neutral", children }: { tone?: "neutral" | "success" | "error"; children: React.ReactNode }) {
  return <p className={`notice is-${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</p>;
}

export function TrainerChip({ id, name, avatarUrl, subtitle = "Reformer eğitmeni" }: { id: string; name: string; avatarUrl: string | null; subtitle?: string }) {
  return <Link href={`/egitmen/${id}`} className="instructor-row"><Avatar name={name} src={avatarUrl} size={52}/><div><strong>{name}</strong><span>{subtitle}</span></div><FlowlyIcon name="chevron-right" size={18}/></Link>;
}

/** The home page's floating flowers; `focus` pulls one of them sharp (used on login and signup). */
export function FloatingFlowers({ focus }: { focus?: "left" | "right" }) {
  return <>
    <div className={`home-flower is-left${focus === "left" ? " is-sharp" : ""}`} aria-hidden="true"><span/></div>
    <div className={`home-flower is-right${focus === "right" ? " is-sharp" : ""}`} aria-hidden="true"><span/></div>
  </>;
}
