import Link from "next/link";
import { redirect } from "next/navigation";
import { FlowlyIcon, type FlowlyIconName } from "@/components/flowly/icons";
import { LightStatusBar, NativePushPrompt, SuccessHaptic } from "@/components/flowly/native";
import { CancelBookingForm } from "@/components/flowly/forms";
import { PushPrompt } from "@/components/flowly/push";
import { AppShell } from "@/components/flowly/shell";
import { Brand, ButtonLink } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";
import { formatDayLong, formatTime } from "@/lib/format";
import { pushPublicKey } from "@/lib/push";
import { isNativeApp } from "@/lib/request";
import { studio } from "@/lib/studio";
import { studioRequestMessage, whatsappLink } from "@/lib/whatsapp";
import { getMemberBooking } from "@/lib/queries";

export const metadata = { title: "Talebin alındı" };

export default async function BookingSuccessPage({ searchParams }: PageProps<"/rezervasyon/basarili">) {
  const { r } = await searchParams;
  const user = await requireUser({ role: "member", next: "/rezervasyonlar" });
  const booking = typeof r === "string" ? await getMemberBooking(user.id, r) : null;
  if (!booking) redirect("/rezervasyonlar");
  // Web Push only exists for home-screen web apps in Safari, not inside the iOS app.
  const inApp = await isNativeApp();
  const publicKey = inApp ? null : pushPublicKey();
  const whatsapp = whatsappLink(studio.phone, studioRequestMessage({ memberName: user.name, startsAt: booking.startsAt }));

  // Picked the wrong class? The request can be taken back right here; afterwards the page says so.
  if (booking.status === "cancelled") return <AppShell bare className="success-screen">
    <div className="success-photo"/>
    <section className="success-withdrawn">
      <LightStatusBar/>
      <h1>Talebin geri alındı.</h1>
      <p>Yerin diğer üyelere açıldı. Programdan doğru dersi seçebilirsin.</p>
      <ButtonLink href="/dersler">Ders Programına Dön</ButtonLink>
      <Brand light/>
    </section>
  </AppShell>;

  return <AppShell bare className="success-screen">
    <div className="success-photo"/>
    <section>
      <SuccessHaptic/>
      <LightStatusBar/>
      <div className="success-check"><FlowlyIcon name="check" size={36}/></div>
      <h1>Talebin alındı.</h1>
      <p>Eğitmen onayladığında rezervasyonun kesinleşecek; sana e-postayla haber vereceğiz.</p>
      <div className="success-details">
        <Line icon="calendar" label="Tarih" value={formatDayLong(booking.startsAt)}/>
        <Line icon="clock" label="Saat" value={`${formatTime(booking.startsAt)} · ${booking.durationMin} dk`}/>
        <Line icon="user" label="Eğitmen" value={booking.trainerName}/>
      </div>
      {/* Optional: the trainer is already notified by e-mail, push and the panel. */}
      {whatsapp && <div className="whatsapp-card">
        <span className="whatsapp-card-icon"><FlowlyIcon name="chat" size={22}/></span>
        <div><strong>Stüdyoya da haber vermek ister misin?</strong><p>Özel bir isteğin ya da sorun varsa WhatsApp&apos;tan yaz; mesajın hazır.</p></div>
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flowly-button whatsapp-button"><FlowlyIcon name="chat" size={20}/>WhatsApp&apos;tan Yaz</a>
      </div>}
      {inApp ? <NativePushPrompt/> : publicKey && <PushPrompt publicKey={publicKey}/>}
      <ButtonLink href={`/rezervasyonlar/${booking.id}`} variant="outline">Talebi Gör</ButtonLink>
      <Link href="/dersler">Ders programına dön</Link>
      {(booking.status === "pending" || booking.status === "approved") && <CancelBookingForm bookingId={booking.id} label="Yanlış ders mi seçtin? Talebi geri al" confirmLabel="Evet, geri al" question={`${formatDayLong(booking.startsAt)} ${formatTime(booking.startsAt)} dersi için talebini geri almak istediğine emin misin?`}/>}
      <Brand light/>
    </section>
  </AppShell>;
}

function Line({ icon, label, value }: { icon: FlowlyIconName; label: string; value: string }) {
  return <div><FlowlyIcon name={icon}/><p><span>{label}</span><strong>{value}</strong></p></div>;
}
