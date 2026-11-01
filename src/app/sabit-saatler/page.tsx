import Link from "next/link";
import { FixedSlotRequestForm, StopFixedSlotForm } from "@/components/flowly/fixed-slots";
import { FlowlyIcon } from "@/components/flowly/icons";
import { AppShell } from "@/components/flowly/shell";
import { EmptyState, Notice, SectionTitle, StatusBadge, TopBar } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";
import { MAX_FIXED_SLOTS, fixedSlotStatusLabels, fixedSlotWeekdays, slotLabel, stoppedNotice, weekdayLabels } from "@/lib/fixed-slot-rules";
import { listMemberFixedSlots } from "@/lib/queries";
import { lessonStartTimes, studio } from "@/lib/studio";

export const metadata = { title: "Sabit saatlerim" };

const weekdayShort: Record<number, string> = { 1: "PZT", 2: "SAL", 3: "ÇAR", 4: "PER", 5: "CUM", 6: "CMT" };

export default async function FixedSlotsPage({ searchParams }: PageProps<"/sabit-saatler">) {
  const user = await requireUser({ role: "member", next: "/sabit-saatler" });
  const [slots, notice] = await Promise.all([listMemberFixedSlots(user.id), searchParams.then((params) => stoppedNotice(params, studio.cancellationHours))]);

  return <AppShell nav={false}>
    <TopBar back="/rezervasyonlar" title="Sabit saatlerim"/>
    <section>
      <h1>Her hafta aynı saatte.</h1>
      <p className="muted-note">Düzenli geldiğin gün ve saati seç. Eğitmenin bir kez onaylar; sonra o saatteki derslere her hafta otomatik eklenirsin, tek tek talep göndermen gerekmez.</p>
      {notice && <Notice tone="success">{notice}</Notice>}

      {slots.length ? <div className="booking-list">{slots.map((slot) => <article key={slot.id} className="booking-list-row">
        <div className="date-block"><strong>{slot.startTime.slice(0, 2)}</strong><span>{weekdayShort[slot.weekday]}</span></div>
        <div className="booking-list-main">
          <h2>{weekdayLabels[slot.weekday]}</h2>
          <p>{slot.startTime} · her hafta</p>
          {slot.nextBooking && <Link href={`/rezervasyonlar/${slot.nextBooking}`} className="see-all">Sıradaki dersin<FlowlyIcon name="arrow-right" size={15}/></Link>}
          <StopFixedSlotForm slotId={slot.id} label={slotLabel(slot)}/>
        </div>
        <StatusBadge tone={slot.status === "active" ? "moss" : "blue"} dot>{fixedSlotStatusLabels[slot.status]}</StatusBadge>
      </article>)}</div>
        : <EmptyState icon="repeat" title="Henüz sabit saatin yok." text="Her hafta aynı gün ve saatte geliyorsan aşağıdan ekleyebilirsin."/>}

      {slots.length < MAX_FIXED_SLOTS && <>
        <SectionTitle title="Yeni sabit saat"/>
        <FixedSlotRequestForm weekdays={fixedSlotWeekdays.map((day) => [String(day), weekdayLabels[day]])} times={lessonStartTimes}/>
      </>}

      <SectionTitle title="Nasıl işler?"/>
      <p className="muted-note">Gelemeyeceğin bir hafta olursa o haftanın rezervasyonunu ders saatinden {studio.cancellationHours} saat öncesine kadar iptal edebilirsin. Sabit saatin devam eder.</p>
      <p className="muted-note">O hafta ders doluysa seni bekleme listesine alırız ve yer açılınca haber veririz.</p>
      <p className="muted-note">Sabit saatini kaldırırsan ileri tarihli otomatik rezervasyonların da iptal edilir.</p>
    </section>
  </AppShell>;
}
