/* eslint-disable @next/next/no-img-element -- Local studio photo with a fixed crop. */
import { notFound } from "next/navigation";
import { CancelBookingForm, EffortForm, PlaylistForm } from "@/components/flowly/forms";
import { FlowlyIcon } from "@/components/flowly/icons";
import { AppShell } from "@/components/flowly/shell";
import { ButtonLink, InfoRow, Notice, StatusBadge, TopBar, TrainerChip, WhatsAppLink, bookingTone } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";
import { bookingStatusLabels, formatDayLong, formatTime, hasStarted, hoursUntil, lessonLevelLabels, lessonTypeLabels } from "@/lib/format";
import { bookingGoogleLink } from "@/lib/booking-calendar";
import { calendarToken } from "@/lib/calendar-token";
import { isNativeApp } from "@/lib/request";
import { getMemberBooking } from "@/lib/queries";
import { studio } from "@/lib/studio";
import { studioRequestMessage, whatsappLink } from "@/lib/whatsapp";

export const metadata = { title: "Rezervasyon" };

export default async function BookingDetailPage({ params }: PageProps<"/rezervasyonlar/[id]">) {
  const { id } = await params;
  const user = await requireUser({ role: "member", next: `/rezervasyonlar/${id}` });
  const booking = await getMemberBooking(user.id, id);
  if (!booking) notFound();

  const hoursLeft = hoursUntil(booking.startsAt);
  const active = booking.status === "pending" || booking.status === "approved";
  const finished = hoursLeft <= 0;
  const lockedReason = booking.status === "approved" && hoursLeft < studio.cancellationHours
    ? `Derse ${studio.cancellationHours} saatten az kaldığı için çevrimiçi iptal kapandı. Gelemeyeceksen lütfen stüdyoya haber ver.` : undefined;
  const absent = booking.attendance === "no_show";
  const attended = booking.attendance === "attended";
  // Effort and reviews open once the class is over, only for members the trainer marked as present.
  const ended = hasStarted(new Date(booking.startsAt.getTime() + booking.durationMin * 60_000));
  const canRate = ended && booking.status === "approved" && booking.lessonStatus === "published" && attended;
  const status = finished && booking.status === "approved" ? attended ? "Katıldın" : absent ? "Katılmadın" : "Katılım bekleniyor" : bookingStatusLabels[booking.status];
  // The iOS app's web view cannot open an .ics file: there the link goes to Safari (target=_blank),
  // signed because Safari has no session. In a browser the plain link works as before.
  const inApp = await isNativeApp();
  const token = inApp ? calendarToken(booking.id, process.env.AUTH_COOKIE_SECRET ?? "") : null;
  const calendarLink = { href: `/rezervasyonlar/${booking.id}/takvim${token ? `?anahtar=${token}` : ""}`, ...(token ? { target: "_blank", rel: "noreferrer" } : {}) };

  return <AppShell className="booking-detail-screen" nav={false}>
    <TopBar back="/rezervasyonlar" title="Rezervasyon"/>
    <section>
      <img className="detail-studio-image" src={studio.heroImage} alt=""/>
      <div className="detail-heading"><h1>{lessonTypeLabels[booking.type]}</h1><StatusBadge tone={absent ? "plum" : finished && booking.status === "approved" ? "neutral" : bookingTone[booking.status]} dot>{status}</StatusBadge></div>
      {booking.lessonStatus === "cancelled" && <Notice>Bu ders eğitmen tarafından iptal edildi.</Notice>}
      <div className="detail-list">
        <InfoRow icon="calendar" label="Tarih" value={formatDayLong(booking.startsAt)}/>
        <InfoRow icon="clock" label="Saat" value={`${formatTime(booking.startsAt)} · ${booking.durationMin} dk`}/>
        <InfoRow icon="level" label="Seviye" value={lessonLevelLabels[booking.level]}/>
        {studio.address && <InfoRow icon="pin" label="Adres" value={studio.address}/>}
      </div>
      <div className="detail-trainer"><TrainerChip id={booking.trainerId} name={booking.trainerName} avatarUrl={booking.trainerAvatar}/></div>
      {(booking.memberNote || booking.trainerNote) && <div className="note-pair">
        {booking.memberNote && <p><span>Senin notun</span>{booking.memberNote}</p>}
        {booking.trainerNote && <p><span>Eğitmenin notu</span>{booking.trainerNote}</p>}
      </div>}
      <div className="detail-actions">
        {absent && <Notice>Eğitmenin bu derse katılmadığını işaretledi. Bir yanlışlık varsa stüdyoya haber ver.</Notice>}
        {finished && booking.status === "approved" && !absent && !attended && <p className="muted-note">Eğitmenin katılımını işaretlediğinde efor puanı ve değerlendirme burada açılacak.</p>}
        {canRate && <section id="efor" className="effort-card"><EffortForm bookingId={booking.id} current={booking.effort}/></section>}
        {finished && attended && (booking.reviewId ? <ButtonLink href={`/yorum-yaz?r=${booking.id}`} variant="outline">Yorumu Düzenle</ButtonLink> : <ButtonLink href={`/yorum-yaz?r=${booking.id}`} variant={canRate && booking.effort === null ? "outline" : "primary"}>Dersi Değerlendir</ButtonLink>)}
        {!finished && active && <>
          {booking.status === "approved" && booking.lessonStatus === "published" && <div className="calendar-actions">
            <a {...calendarLink} className="flowly-button is-outline"><FlowlyIcon name="calendar" size={20}/>Takvime Ekle</a>
            <a href={bookingGoogleLink({ id: booking.id, startsAt: booking.startsAt, durationMin: booking.durationMin, level: booking.level, trainerName: booking.trainerName })} target="_blank" rel="noopener noreferrer" className="see-all">Google Takvim&apos;e ekle</a>
          </div>}
          {booking.status === "pending" && <WhatsAppLink href={whatsappLink(studio.phone, studioRequestMessage({ memberName: user.name, startsAt: booking.startsAt }))}>Stüdyoya WhatsApp&apos;tan yaz</WhatsAppLink>}
          <section className="playlist-card" aria-label="Müzik önerin"><PlaylistForm bookingId={booking.id} current={booking.playlistUrl}/></section>
          <p className="policy-line">Derse {studio.cancellationHours} saat kalana kadar iptal edebilirsin.</p>
          {!lockedReason && <ButtonLink href={`/rezervasyonlar/${booking.id}/degistir`} variant="outline">Tarih veya Saati Değiştir</ButtonLink>}
          {studio.address && <ButtonLink href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${studio.name} ${studio.address}`)}`} variant="outline">Yol Tarifi Al</ButtonLink>}
          <CancelBookingForm bookingId={booking.id} lockedReason={lockedReason}/>
        </>}
        {(booking.status === "cancelled" || booking.status === "rejected") && <ButtonLink href="/dersler">Başka Bir Ders Seç</ButtonLink>}
        {booking.status === "cancelled" && booking.decidedAt && !finished && <a {...calendarLink} className="see-all calendar-remove"><FlowlyIcon name="calendar" size={16}/>Takvimine eklediysen kaldır</a>}
      </div>
    </section>
  </AppShell>;
}
