import Link from "next/link";
import { markNotificationsRead } from "@/app/actions/account";
import { FlowlyIcon, type FlowlyIconName } from "@/components/flowly/icons";
import { AppShell } from "@/components/flowly/shell";
import { SwipeToDelete } from "@/components/flowly/swipe-delete";
import { EmptyState, TopBar } from "@/components/flowly/ui";
import { homeFor, requireUser } from "@/lib/dal";
import { relativeTime } from "@/lib/format";
import { listNotifications } from "@/lib/queries";

export const metadata = { title: "Bildirimler" };

type Item = Awaited<ReturnType<typeof listNotifications>>[number];
const icons: Record<Item["kind"], FlowlyIconName> = { request: "bookmark", approved: "check", rejected: "x", cancelled: "x", review: "star", info: "bell" };

export default async function NotificationsPage() {
  const user = await requireUser({ next: "/bildirimler" });
  const items = await listNotifications(user.id);
  const unread = items.filter((item) => !item.readAt);
  const earlier = items.filter((item) => item.readAt);

  return <AppShell className="notifications-screen">
    <TopBar back={homeFor(user)} action={unread.length > 0 ? <form action={markNotificationsRead}><button type="submit" className="save-button">Tümünü okundu say</button></form> : undefined}/>
    <section>
      <h1>Bildirimler</h1>
      {items.length === 0 && <EmptyState icon="bell" title="Henüz bildirimin yok." text="Rezervasyon talepleri, onaylar ve iptaller burada görünecek."/>}
      {items.length > 0 && <p className="swipe-hint">Silmek için bildirimi sola kaydır.</p>}
      {unread.length > 0 && <><h2>Yeni</h2>{unread.map((item) => <Row key={item.id} item={item}/>)}</>}
      {earlier.length > 0 && <><h2>Daha önce</h2>{earlier.map((item) => <Row key={item.id} item={item}/>)}</>}
    </section>
  </AppShell>;
}

function Row({ item }: { item: Item }) {
  const body = <><FlowlyIcon name={icons[item.kind]}/><div><strong>{!item.readAt && <i/>}{item.title}</strong><span>{item.body}</span></div><time dateTime={item.createdAt.toISOString()}>{relativeTime(item.createdAt)}</time>{item.href ? <FlowlyIcon name="chevron-right" size={18}/> : <span/>}</>;
  const row = item.href ? <Link href={item.href} className={`notification-row${item.readAt ? " is-read" : ""}`}>{body}</Link> : <div className={`notification-row${item.readAt ? " is-read" : ""}`}>{body}</div>;
  return <SwipeToDelete id={item.id}>{row}</SwipeToDelete>;
}
