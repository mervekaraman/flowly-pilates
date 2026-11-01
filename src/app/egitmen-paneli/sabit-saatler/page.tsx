import { FixedSlotDecisionForm, StopFixedSlotForm } from "@/components/flowly/fixed-slots";
import { AppShell } from "@/components/flowly/shell";
import { Avatar, EmptyState, Notice, SectionTitle, TopBar } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";
import { slotLabel, stoppedNotice } from "@/lib/fixed-slot-rules";
import { relativeTime } from "@/lib/format";
import { listStudioFixedSlots } from "@/lib/queries";
import { lessonDefaults, studio } from "@/lib/studio";

export const metadata = { title: "Sabit saatler" };

type Slot = Awaited<ReturnType<typeof listStudioFixedSlots>>[number];

/** What the last decision or ending did, read from the URL the action redirects to. */
function decisionNotice(params: Record<string, string | string[] | undefined>) {
  const stopped = stoppedNotice(params, studio.cancellationHours);
  if (stopped) return stopped;
  if (params.karar === "ret") return "Talep reddedildi; üyeye haber verildi.";
  if (params.karar !== "onay") return null;
  const booked = Number(params.eklendi) || 0;
  const full = Number(params.dolu) || 0;
  return `Sabit saat onaylandı. ${booked ? `Üye açık olan ${booked} derse eklendi.` : "Bu saatte henüz ders yok; ders açtığında üye otomatik eklenecek."}${full ? ` ${full} ders dolu olduğu için üye bekleme listesine alındı.` : ""}`;
}

export default async function TrainerFixedSlotsPage({ searchParams }: PageProps<"/egitmen-paneli/sabit-saatler">) {
  await requireUser({ role: "trainer", next: "/egitmen-paneli/sabit-saatler" });
  const [slots, notice] = await Promise.all([listStudioFixedSlots(), searchParams.then(decisionNotice)]);
  const pending = slots.filter((slot) => slot.status === "pending");
  const active = slots.filter((slot) => slot.status === "active");
  // Members already fixed at each weekday + hour, so a request can be judged against the room size.
  const plan = new Map<string, Slot[]>();
  for (const slot of active) plan.set(slotLabel(slot), [...(plan.get(slotLabel(slot)) ?? []), slot]);

  return <AppShell className="requests-screen" nav={false}>
    <TopBar back="/egitmen-paneli/talepler" title="Sabit saatler"/>
    <section>
      <h1>Sabit<br/>saatler</h1>
      <p className="muted-note">Onayladığın üyeler, o gün ve saatte açtığın derslere her hafta otomatik ve onaylı olarak eklenir. Ders açılır açılmaz yerleri önce onlara ayrılır.</p>
      {notice && <Notice tone="success">{notice}</Notice>}

      <SectionTitle title={`Bekleyen talepler${pending.length ? ` (${pending.length})` : ""}`}/>
      {pending.length ? <div className="request-list">{pending.map((slot) => {
        const already = plan.get(slotLabel(slot))?.length ?? 0;
        return <article key={slot.id}>
          <div className="request-person">
            <Avatar name={slot.memberName} src={slot.memberAvatar} size={64}/>
            <div>
              <strong>{slot.memberName}</strong>
              <span>Her hafta {slotLabel(slot)}</span>
              <span className="meta-line"><span>Bu saatte {already} sabit üye var</span><span>Varsayılan kontenjan {lessonDefaults.capacity}</span></span>
              <time>Talep · {relativeTime(slot.createdAt)}</time>
            </div>
          </div>
          <div className="request-actions"><FixedSlotDecisionForm slotId={slot.id}/></div>
        </article>;
      })}</div> : <EmptyState icon="repeat" title="Bekleyen sabit saat talebi yok." text="Bir üye sabit saat istediğinde burada ve e-postanda göreceksin."/>}

      <SectionTitle title="Haftalık plan"/>
      {plan.size ? [...plan].map(([label, members]) => <div key={label} className="request-list">
        <h2>{label} · {members.length} üye</h2>
        {members.map((slot) => <article key={slot.id}>
          <div className="request-person"><Avatar name={slot.memberName} src={slot.memberAvatar} size={48}/><div><strong>{slot.memberName}</strong></div></div>
          <div className="request-actions"><StopFixedSlotForm slotId={slot.id} label={`${slot.memberName} · ${label}`} asTrainer/></div>
        </article>)}
      </div>) : <p className="muted-note">Henüz onaylı sabit saat yok.</p>}
    </section>
  </AppShell>;
}
