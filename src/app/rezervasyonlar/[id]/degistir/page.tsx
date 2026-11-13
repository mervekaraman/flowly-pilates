import { notFound, redirect } from "next/navigation";
import { RescheduleForm } from "@/components/flowly/forms";
import { AppShell } from "@/components/flowly/shell";
import { Notice, TopBar } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";
import { formatDayLong, formatTime, lessonLevelLabels } from "@/lib/format";
import { getMemberBooking, listLessons } from "@/lib/queries";
import { studio } from "@/lib/studio";

export const metadata = { title: "Rezervasyonu değiştir" };

export default async function ReschedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const now = new Date();
  const user = await requireUser({ role: "member", next: `/rezervasyonlar/${id}/degistir` });
  const booking = await getMemberBooking(user.id, id);
  if (!booking) notFound();
  if (!["pending", "approved"].includes(booking.status) || booking.startsAt.getTime() <= now.getTime()) redirect(`/rezervasyonlar/${id}`);
  const locked = booking.status === "approved" && (booking.startsAt.getTime() - now.getTime()) / 3_600_000 < studio.cancellationHours;
  const rows = locked ? [] : await listLessons({ from: now, to: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000), viewerId: user.id });
  const options = rows.filter((row) => row.id !== booking.lessonId).map((row) => ({
    id: row.id,
    label: `${formatDayLong(row.startsAt)} · ${formatTime(row.startsAt)} · ${lessonLevelLabels[row.level]}${row.taken >= row.capacity ? " · dolu" : ""}`,
    disabled: row.taken >= row.capacity || row.myStatus === "pending" || row.myStatus === "approved",
  }));

  return <AppShell nav={false}>
    <TopBar back={`/rezervasyonlar/${id}`} title="Rezervasyonu değiştir"/>
    <section>
      <h1>Yeni dersini seç.</h1>
      <p className="muted-note">Mevcut rezervasyonun yeni talep tek işlemde oluşturulduğunda iptal edilir. Yeni saat de eğitmen onayından geçer.</p>
      {booking.fixedSlotId && <Notice>Bu ders sabit saatinden geliyor. Yalnızca bu hafta değişir; sonraki haftalarda sabit saatinde devam edersin.</Notice>}
      {locked ? <Notice tone="error">Derse {studio.cancellationHours} saatten az kaldığı için çevrimiçi değişiklik kapandı. Stüdyoyla iletişime geç.</Notice>
        : options.length ? <RescheduleForm bookingId={booking.id} lessons={options}/> : <Notice>Önümüzdeki üç haftada uygun başka ders bulunamadı.</Notice>}
    </section>
  </AppShell>;
}
