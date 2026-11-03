import Link from "next/link";
import { QuickApproveForm } from "@/components/flowly/forms";
import { FlowlyIcon } from "@/components/flowly/icons";
import { AppShell } from "@/components/flowly/shell";
import { Avatar, Brand, ButtonLink, EmptyState, SeeAll, SectionTitle } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";
import { atStudioTime, dayRange, formatDayLong, formatTime, lessonLevelLabels, relativeTime, startOfWeek, todayKey } from "@/lib/format";
import { listLessons, listTrainerRequests, trainerStats } from "@/lib/queries";
import { studio } from "@/lib/studio";

export const metadata = { title: "Eğitmen paneli" };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", hour12: false }).format(new Date()));
  return hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";
}

export default async function TrainerDashboardPage() {
  const user = await requireUser({ role: "trainer", next: "/egitmen-paneli" });
  const today = todayKey();
  const [start, end] = dayRange(today);
  const [stats, todays, upcoming, pending] = await Promise.all([
    trainerStats(user.id, startOfWeek(today)),
    listLessons({ from: start, to: end, trainerId: user.id }),
    listLessons({ from: end, to: new Date(end.getTime() + 14 * 24 * 60 * 60 * 1000), trainerId: user.id }),
    listTrainerRequests(user.id, "pending", 3),
  ]);
  const flow = todays.length ? todays : upcoming.filter((lesson) => formatDayLong(lesson.startsAt) === formatDayLong(upcoming[0]?.startsAt ?? new Date(0)));
  const flowTitle = todays.length ? "Bugünün akışı" : flow.length ? `Sıradaki gün · ${formatDayLong(flow[0].startsAt)}` : "Yaklaşan dersler";

  return <AppShell className="trainer-dashboard-screen">
    <header className="feed-header"><div><Brand/><p className="location-link"><FlowlyIcon name="studio" size={20}/>{studio.name} · Eğitmen</p></div><Link href="/bildirimler" aria-label="Bildirimler"><FlowlyIcon name="bell" size={26}/></Link></header>
    <section>
      <div className="dashboard-head">
        <div><h1>{greeting()},<br/>{user.name.split(" ")[0]}.</h1><p>{formatDayLong(atStudioTime(today, "12:00"))} · {todays.length ? `bugün ${todays.length} dersin var` : "bugün dersin yok"}</p></div>
        <ButtonLink href="/egitmen-paneli/yeni-ders">Yeni Ders Saati</ButtonLink>
      </div>
      <div className="trainer-stats">
        <Link href="/egitmen-paneli/takvim"><strong>{stats.weekLessons}</strong><span>Bu hafta ders</span></Link>
        <Link href="/egitmen-paneli/takvim"><strong>{stats.weekParticipants}</strong><span>Onaylı katılımcı</span></Link>
        <Link href="/egitmen-paneli/talepler"><strong>{stats.pending}</strong><span>Bekleyen talep</span></Link>
      </div>
      <div className="dashboard-columns">
        <div>
          <SectionTitle title={flowTitle} action={<SeeAll href="/egitmen-paneli/takvim">Takvim</SeeAll>}/>
          {flow.length ? <div className="trainer-flow">{flow.map((lesson) => <Link key={lesson.id} href={`/egitmen-paneli/dersler/${lesson.id}`}><strong>{formatTime(lesson.startsAt)}</strong><span>{lessonLevelLabels[lesson.level]}<small>{lesson.durationMin} dk</small></span><em className={lesson.taken >= lesson.capacity ? "is-full" : ""}>{lesson.taken}/{lesson.capacity}</em><FlowlyIcon name="chevron-right" size={18}/></Link>)}</div>
            : <EmptyState icon="calendar" title="Önümüzdeki günlerde dersin yok." action={<Link href="/egitmen-paneli/yeni-ders" className="see-all">Ders saati aç<FlowlyIcon name="arrow-right" size={15}/></Link>}/>}
        </div>
        <div>
          <SectionTitle title="Bekleyen talepler" action={stats.pending > 0 ? <SeeAll href="/egitmen-paneli/talepler"/> : undefined}/>
          {pending.length ? <div className="pending-list">{pending.map((request) => <div key={request.id} className="pending-preview">
            <Avatar name={request.memberName} src={request.memberAvatar} size={48}/>
            <Link href={`/egitmen-paneli/talepler/${request.id}`}><strong>{request.memberName}</strong><span>{formatDayLong(request.startsAt)} · {formatTime(request.startsAt)}</span><small>{relativeTime(request.createdAt)}</small></Link>
            <QuickApproveForm bookingId={request.id}/>
          </div>)}</div> : <p className="muted-note">Şu an bekleyen talep yok.</p>}
        </div>
      </div>
    </section>
  </AppShell>;
}
