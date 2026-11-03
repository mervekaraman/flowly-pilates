import Link from "next/link";
import { QuickApproveForm } from "@/components/flowly/forms";
import { AppShell } from "@/components/flowly/shell";
import { Avatar, ButtonLink, EmptyState, StatusBadge, WhatsAppLink } from "@/components/flowly/ui";
import { FlowlyIcon } from "@/components/flowly/icons";
import { requireUser } from "@/lib/dal";
import { formatDayLong, formatTime, hasStarted, lessonLevelLabels, relativeTime } from "@/lib/format";
import { appUrl } from "@/lib/mail";
import { whatsappLink, whatsappMessage } from "@/lib/whatsapp";
import { countPendingFixedSlots, listTrainerRequests, trainerStats, type RequestFilter } from "@/lib/queries";
import { startOfWeek, todayKey } from "@/lib/format";

export const metadata = { title: "Rezervasyon talepleri" };

const tabs: [RequestFilter, string, string][] = [["pending", "bekleyen", "Bekleyen"], ["approved", "onaylanan", "Onaylanan"], ["rejected", "reddedilen", "Reddedilen"]];

export default async function RequestsPage({ searchParams }: PageProps<"/egitmen-paneli/talepler">) {
  const user = await requireUser({ role: "trainer", next: "/egitmen-paneli/talepler" });
  const durum = (await searchParams).durum;
  const status = tabs.find(([, slug]) => slug === durum)?.[0] ?? "pending";
  const [requests, stats, pendingFixed] = await Promise.all([listTrainerRequests(user.id, status), trainerStats(user.id, startOfWeek(todayKey())), countPendingFixedSlots()]);

  return <AppShell className="requests-screen">
    <section>
      <h1>Rezervasyon<br/>talepleri</h1>
      <Link href="/egitmen-paneli/sabit-saatler" className="see-all fixed-slots-link">Sabit saatler{pendingFixed > 0 ? ` · ${pendingFixed} yeni talep` : ""}<FlowlyIcon name="arrow-right" size={15}/></Link>
      <div className="tab-row request-tabs" role="tablist">{tabs.map(([key, slug, label]) => <Link key={key} href={key === "pending" ? "/egitmen-paneli/talepler" : `/egitmen-paneli/talepler?durum=${slug}`} role="tab" aria-selected={status === key} className={status === key ? "is-active" : ""}>{label}{key === "pending" && stats.pending > 0 && <b className="tab-count">{stats.pending}</b>}</Link>)}</div>
      {requests.length ? <div className="request-list">{requests.map((request) => <article key={request.id}>
        <Link href={`/egitmen-paneli/talepler/${request.id}`} className="request-person">
          <Avatar name={request.memberName} src={request.memberAvatar} size={64}/>
          <div>
            <strong>{request.memberName}</strong>
            <span>{formatDayLong(request.startsAt)}, {formatTime(request.startsAt)}</span>
            <span className="meta-line"><span>{lessonLevelLabels[request.level]}</span><span>{request.taken}/{request.capacity} dolu</span></span>
            {request.memberNote && <q>{request.memberNote}</q>}
            {request.playlistUrl && <span className="playlist-tag"><FlowlyIcon name="music" size={14}/>Çalma listesi önerdi</span>}
            <time>{status === "pending" ? "Talep" : status === "approved" ? "Onay" : "Ret"} · {relativeTime(status === "pending" ? request.createdAt : request.decidedAt ?? request.createdAt)}</time>
          </div>
        </Link>
        {status === "pending"
          ? <div className="request-actions"><ButtonLink href={`/egitmen-paneli/talepler/${request.id}`} variant="outline" icon={false}>İncele</ButtonLink><QuickApproveForm bookingId={request.id}/></div>
          : <div className="request-status"><StatusBadge tone={status === "approved" ? "moss" : "plum"} dot>{status === "approved" ? "Onaylandı" : "Reddedildi"}</StatusBadge>{!hasStarted(request.startsAt) && <WhatsAppLink href={whatsappLink(request.memberPhone, whatsappMessage({ topic: status, memberName: request.memberName, trainerName: user.name, startsAt: request.startsAt, trainerNote: request.trainerNote, siteUrl: appUrl() }))}>WhatsApp</WhatsAppLink>}<Link href={`/egitmen-paneli/dersler/${request.lessonId}`} className="see-all">Ders listesi<FlowlyIcon name="arrow-right" size={15}/></Link></div>}
      </article>)}</div>
        : <EmptyState icon="users" title={status === "pending" ? "Bekleyen talep yok." : "Bu bölümde talep yok."} text={status === "pending" ? "Yeni bir talep geldiğinde burada ve e-postanda göreceksin." : undefined}/>}
    </section>
  </AppShell>;
}
