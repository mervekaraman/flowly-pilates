/* eslint-disable @next/next/no-img-element -- Local studio photo with a fixed crop. */
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingRequestForm, WaitlistForm } from "@/components/flowly/forms";
import { SeatBadge, seatsLeft } from "@/components/flowly/lessons";
import { AppShell } from "@/components/flowly/shell";
import { ButtonLink, InfoRow, Notice, StatusBadge, TopBar, TrainerChip, bookingTone } from "@/components/flowly/ui";
import { getCurrentUser } from "@/lib/dal";
import { bookingStatusLabels, dayKey, formatDayLong, formatTime, hasStarted, lessonLevelLabels, lessonTypeLabels } from "@/lib/format";
import { packageNeedsAttention } from "@/lib/package-rules";
import { getLesson, isOnWaitlist, memberPackageState } from "@/lib/queries";
import { studio } from "@/lib/studio";

export const metadata = { title: "Ders detayı" };

export default async function LessonPage({ params }: PageProps<"/dersler/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const lesson = await getLesson(id, user?.role === "member" ? user.id : undefined);
  if (!lesson) notFound();

  const left = seatsLeft(lesson);
  const started = hasStarted(lesson.startsAt);
  const active = lesson.myStatus === "pending" || lesson.myStatus === "approved";

  let booking: React.ReactNode;
  if (lesson.status === "cancelled") booking = <Notice>Bu ders eğitmen tarafından iptal edildi.</Notice>;
  else if (started) booking = <Notice>Bu ders başladı ya da sona erdi.</Notice>;
  else if (active && lesson.myBookingId) booking = <><div className="booking-state"><StatusBadge tone={bookingTone[lesson.myStatus!]} dot>{bookingStatusLabels[lesson.myStatus!]}</StatusBadge><p>{lesson.myStatus === "approved" ? "Bu derste yerin ayrıldı." : "Talebin eğitmen onayı bekliyor."}</p></div><ButtonLink href={`/rezervasyonlar/${lesson.myBookingId}`}>Rezervasyonu Gör</ButtonLink></>;
  else if (!user) booking = <><ButtonLink href={`/giris?sonra=/dersler/${lesson.id}`}>Rezervasyon İçin Giriş Yap</ButtonLink><p className="side-switch">Hesabın yok mu? <Link href={`/uye-ol?sonra=/dersler/${lesson.id}`}>Üye ol</Link></p></>;
  else if (user.role === "trainer") booking = <Notice>Eğitmen hesabıyla rezervasyon yapılamaz. Danışan hesabıyla giriş yapmalısın.</Notice>;
  else if (left === 0) booking = <><Notice>Bu derste yer kalmadı.</Notice><WaitlistForm lessonId={lesson.id} onList={await isOnWaitlist(lesson.id, user.id)}/><Link href={`/dersler?gun=${dayKey(lesson.startsAt)}`} className="side-switch-link">Başka bir saat seç</Link></>;
  else {
    // An empty or expired package does not block the request (the trainer decides), but the member should know.
    const pkg = await memberPackageState(user.id);
    booking = <>{packageNeedsAttention(pkg) && <Notice>{pkg.kind === "exhausted" ? "Paketindeki dersler bitti." : "Paketinin süresi doldu."} Talebini yine gönderebilirsin; yeni paket için stüdyoyla görüşebilirsin.</Notice>}<BookingRequestForm lessonId={lesson.id}/></>;
  }

  return <AppShell className="lesson-screen" nav={false}>
    <TopBar back={`/dersler?gun=${dayKey(lesson.startsAt)}`} title="Ders detayı"/>
    <section>
      <div className="lesson-detail">
        <div className="booking-overview"><img src={studio.heroImage} alt=""/><div><p className="eyebrow">{studio.name}</p><h1>{lessonTypeLabels[lesson.type]}</h1><p>{formatDayLong(lesson.startsAt)}</p><p>{formatTime(lesson.startsAt)} · {lesson.durationMin} dk</p><SeatBadge lesson={lesson}/></div></div>
        <div className="summary-rows">
          <TrainerChip id={lesson.trainerId} name={lesson.trainerName} avatarUrl={lesson.trainerAvatar}/>
          <InfoRow icon="level" label="Seviye" value={lessonLevelLabels[lesson.level]}/>
          <InfoRow icon="users" label="Kontenjan" value={`${lesson.capacity} kişilik grup · ${left === 0 ? "yer kalmadı" : `${left} yer kaldı`}`}/>
          {lesson.note && <InfoRow icon="document" label="Eğitmenin notu" value={lesson.note}/>}
          <InfoRow icon="document" label="İptal politikası" value={`Derse ${studio.cancellationHours} saat kalana kadar iptal edebilirsin.`}/>
          {studio.address && <InfoRow icon="pin" label="Adres" value={studio.address}/>}
        </div>
      </div>
      <aside className="side-card booking-card">
        <h2>Rezervasyon</h2>
        <div className="booking-card-summary"><span>{formatDayLong(lesson.startsAt)}</span><span>{formatTime(lesson.startsAt)} · {lesson.durationMin} dk</span></div>
        {booking}
      </aside>
    </section>
  </AppShell>;
}
