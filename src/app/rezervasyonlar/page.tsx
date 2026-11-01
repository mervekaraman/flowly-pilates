/* eslint-disable @next/next/no-img-element -- Local studio photo with a fixed crop. */
import Link from "next/link";
import { FlowlyIcon } from "@/components/flowly/icons";
import { AppShell } from "@/components/flowly/shell";
import { Avatar, Brand, ButtonLink, EmptyState, StatusBadge, bookingTone } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";
import { bookingStatusLabels, dayParts, formatTime, hasStarted, lessonLevelLabels, lessonTypeLabels } from "@/lib/format";
import { listMemberBookings } from "@/lib/queries";
import { studio } from "@/lib/studio";

export const metadata = { title: "Rezervasyonlarım" };

type Row = Awaited<ReturnType<typeof listMemberBookings>>[number];

export default async function BookingsPage({ searchParams }: PageProps<"/rezervasyonlar">) {
  const user = await requireUser({ role: "member", next: "/rezervasyonlar" });
  const tab = (await searchParams).sekme === "gecmis" ? "past" : "upcoming";
  const rows = await listMemberBookings(user.id);
  const upcoming = rows.filter((row) => !hasStarted(row.startsAt) && (row.status === "pending" || row.status === "approved"));
  const past = rows.filter((row) => !upcoming.includes(row)).reverse();
  const [featured, ...rest] = upcoming;

  return <AppShell className="bookings-screen">
    <section>
      <Brand/>
      <h1>Rezervasyonlarım</h1>
      <Link href="/sabit-saatler" className="see-all">Her hafta aynı saatte mi geliyorsun? Sabit saatlerim<FlowlyIcon name="arrow-right" size={15}/></Link>
      <div className="tab-row small" role="tablist">
        <Link href="/rezervasyonlar" role="tab" aria-selected={tab === "upcoming"} className={tab === "upcoming" ? "is-active" : ""}>Yaklaşan{upcoming.length > 0 && <b className="tab-count">{upcoming.length}</b>}</Link>
        <Link href="/rezervasyonlar?sekme=gecmis" role="tab" aria-selected={tab === "past"} className={tab === "past" ? "is-active" : ""}>Geçmiş</Link>
      </div>
      {tab === "upcoming" ? (featured ? <>
        <div className="featured-booking">
          <img src={studio.heroImage} alt=""/>
          <div className="booking-info">
            <DateBlock date={featured.startsAt}/>
            <div><h2>{lessonTypeLabels[featured.type]}</h2><p>{lessonLevelLabels[featured.level]}</p><p>{formatTime(featured.startsAt)} · {featured.durationMin} dk{featured.fixedSlotId ? " · Sabit saat" : ""}</p><div className="mini-trainer"><Avatar name={featured.trainerName} src={featured.trainerAvatar} size={36}/><span>{featured.trainerName}</span></div></div>
            <StatusBadge tone={bookingTone[featured.status]} dot>{bookingStatusLabels[featured.status]}</StatusBadge>
          </div>
          <div className="booking-actions"><ButtonLink href={`/rezervasyonlar/${featured.id}`}>Detayı Gör</ButtonLink><ButtonLink href="/dersler" variant="outline">Yeni Ders Seç</ButtonLink></div>
        </div>
        {rest.length > 0 && <div className="booking-list">{rest.map((row) => <BookingListRow key={row.id} row={row}/>)}</div>}
      </> : <EmptyState icon="calendar" title="Yaklaşan bir dersin yok." text="Programdan sana uyan bir saat seçip yerini ayırabilirsin." action={<ButtonLink href="/dersler">Ders Programını Gör</ButtonLink>}/>)
        : past.length ? <div className="booking-list is-past">{past.map((row) => <BookingListRow key={row.id} row={row} past/>)}</div>
          : <EmptyState icon="clock" title="Henüz geçmiş bir dersin yok." text="Katıldığın dersler burada listelenir; buradan değerlendirebilirsin."/>}
    </section>
  </AppShell>;
}

function DateBlock({ date }: { date: Date }) {
  const parts = dayParts(date);
  return <div className="date-block"><strong>{parts.day}</strong><span>{parts.month}</span></div>;
}

function BookingListRow({ row, past = false }: { row: Row; past?: boolean }) {
  const absent = row.attendance === "no_show";
  const attended = past && row.attendance === "attended";
  // After class: rate the effort first, then the review; both stay one tap away.
  const trailing = attended
    ? row.effort === null ? <Link href={`/rezervasyonlar/${row.id}#efor`} className="see-all">Eforunu puanla<FlowlyIcon name="arrow-right" size={15}/></Link>
      : row.reviewId ? <Link href={`/yorum-yaz?r=${row.id}`} className="see-all">Yorumu düzenle<FlowlyIcon name="arrow-right" size={15}/></Link>
        : <Link href={`/yorum-yaz?r=${row.id}`} className="see-all">Değerlendir<FlowlyIcon name="arrow-right" size={15}/></Link>
    : <StatusBadge tone={absent ? "plum" : bookingTone[row.status]} dot={!past}>{past && row.status === "approved" ? absent ? "Katılmadın" : "Katılım bekleniyor" : bookingStatusLabels[row.status]}</StatusBadge>;
  return <div className={`booking-list-row${past ? " is-past" : ""}`}>
    <DateBlock date={row.startsAt}/>
    <Link href={`/rezervasyonlar/${row.id}`} className="booking-list-main"><h2>{lessonTypeLabels[row.type]}</h2><p>{formatTime(row.startsAt)} · {row.durationMin} dk · {row.trainerName}{row.fixedSlotId ? " · Sabit saat" : ""}</p></Link>
    {trailing}
  </div>;
}
