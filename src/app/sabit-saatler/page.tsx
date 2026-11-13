import Link from "next/link";
import { FixedSlotChangeForm, FixedSlotRequestForm, StopFixedSlotForm } from "@/components/flowly/fixed-slots";
import { FlowlyIcon } from "@/components/flowly/icons";
import { AppShell } from "@/components/flowly/shell";
import { EmptyState, Notice, SectionTitle, StatusBadge, TopBar } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";
import { MAX_FIXED_SLOTS, fixedSlotStatusLabels, fixedSlotWeekdays, slotLabel, stoppedNotice, weekdayLabels } from "@/lib/fixed-slot-rules";
import { fixedSlotAvailability, listMemberFixedSlots } from "@/lib/queries";
import { lessonStartTimes, studio } from "@/lib/studio";

export const metadata = { title: "Sabit saatlerim" };

const AVAILABILITY_WEEKS = 4;
const weekdayShort: Record<number, string> = { 1: "PZT", 2: "SAL", 3: "ÇAR", 4: "PER", 5: "CUM", 6: "CMT" };

export default async function FixedSlotsPage({ searchParams }: PageProps<"/sabit-saatler">) {
  const user = await requireUser({ role: "member", next: "/sabit-saatler" });
  const [slots, notice, availability] = await Promise.all([listMemberFixedSlots(user.id), searchParams.then((params) => stoppedNotice(params, studio.cancellationHours)), fixedSlotAvailability(AVAILABILITY_WEEKS)]);
  const weekdays = fixedSlotWeekdays.map((day) => [String(day), weekdayLabels[day]] as [string, string]);
  const byId = new Map(slots.map((slot) => [slot.id, slot]));
  // Active times with a change already requested do not offer another one.
  const changing = new Set(slots.map((slot) => slot.replacesSlotId).filter(Boolean));

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
          <p>{slot.startTime} · her hafta{slot.replacesSlotId && byId.get(slot.replacesSlotId) ? ` · ${slotLabel(byId.get(slot.replacesSlotId)!)} yerine` : ""}</p>
          {slot.nextBooking && <Link href={`/rezervasyonlar/${slot.nextBooking}`} className="see-all">Sıradaki dersin<FlowlyIcon name="arrow-right" size={15}/></Link>}
          {/* One week only: the next class moves, the fixed time carries on the week after. */}
          {slot.nextBooking && <Link href={`/rezervasyonlar/${slot.nextBooking}/degistir`} className="see-all">Bu hafta başka güne al<FlowlyIcon name="arrow-right" size={15}/></Link>}
          <StopFixedSlotForm slotId={slot.id} label={slotLabel(slot)}/>
        </div>
        <StatusBadge tone={slot.status === "active" ? "moss" : "blue"} dot>{slot.replacesSlotId && slot.status === "pending" ? "Değişiklik bekliyor" : fixedSlotStatusLabels[slot.status]}</StatusBadge>
        {slot.status === "active" && !changing.has(slot.id) && <FixedSlotChangeForm slotId={slot.id} label={slotLabel(slot)} weekdays={weekdays} times={lessonStartTimes} availability={availability} weeks={AVAILABILITY_WEEKS}/>}
      </article>)}</div>
        : <EmptyState icon="repeat" title="Henüz sabit saatin yok." text="Her hafta aynı gün ve saatte geliyorsan aşağıdan ekleyebilirsin."/>}

      {slots.length < MAX_FIXED_SLOTS && <>
        <SectionTitle title="Yeni sabit saat"/>
        <FixedSlotRequestForm weekdays={weekdays} times={lessonStartTimes} availability={availability} weeks={AVAILABILITY_WEEKS}/>
      </>}

      <SectionTitle title="Nasıl işler?"/>
      <p className="muted-note">Gelemeyeceğin bir hafta olursa o haftanın rezervasyonunu ders saatinden {studio.cancellationHours} saat öncesine kadar iptal edebilirsin. Sabit saatin devam eder.</p>
      <p className="muted-note">O hafta ders doluysa seni bekleme listesine alırız ve yer açılınca haber veririz.</p>
      <p className="muted-note">Bir hafta başka bir güne gelmek istersen “Bu hafta başka güne al”dan o haftanın dersini seç. Yalnızca o hafta değişir; sonraki hafta sabit saatinde devam edersin. Daha ileri bir haftayı Rezervasyonlarım’dan aynı şekilde değiştirebilirsin.</p>
      <p className="muted-note">Her hafta başka bir gün ya da saatte gelmek istersen “Sabit saatimi değiştir”den yeni saati seç. Eğitmenin onaylayınca eski saatteki ileri tarihli yerlerin boşalır, yeni saatte devam edersin.</p>
      <p className="muted-note">Sabit saatini kaldırırsan ileri tarihli otomatik rezervasyonların da iptal edilir.</p>
    </section>
  </AppShell>;
}
