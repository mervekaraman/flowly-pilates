import Link from "next/link";
import { notFound } from "next/navigation";
import { AddMemberForm, AttendanceToggle, CancelLessonForm, RemoveFromLessonForm } from "@/components/flowly/forms";
import { FlowlyIcon } from "@/components/flowly/icons";
import { AppShell } from "@/components/flowly/shell";
import { Avatar, EmptyState, InfoRow, Notice, StatusBadge, TopBar, WhatsAppLink, bookingTone } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";
import { bookingStatusLabels, dayKey, formatDayLong, formatTime, hasStarted, lessonLevelLabels } from "@/lib/format";
import { isFixedSlotTime, isFixedSlotWeekday, slotLabel, slotOf } from "@/lib/fixed-slot-rules";
import { formatPhone } from "@/lib/forms";
import { appUrl } from "@/lib/mail";
import { getTrainerLesson, listMembers, listWaitlist } from "@/lib/queries";
import { whatsappLink, whatsappMessage } from "@/lib/whatsapp";

export const metadata = { title: "Ders listesi" };

export default async function TrainerLessonPage({ params, searchParams }: PageProps<"/egitmen-paneli/dersler/[id]">) {
  const { id } = await params;
  const { eklendi, duzenlendi, cikarildi, sabit, ileri, dolu } = await searchParams;
  const user = await requireUser({ role: "trainer", next: `/egitmen-paneli/dersler/${id}` });
  const data = await getTrainerLesson(user.id, id);
  if (!data) notFound();
  const { lesson, roster } = data;
  const canAdd = !hasStarted(lesson.startsAt) && lesson.status === "published";
  const members = canAdd ? await listMembers() : [];
  const waiting = canAdd ? await listWaitlist(lesson.id) : [];
  const inClass = new Set(roster.filter((row) => row.status === "approved" || row.status === "pending").map((row) => row.memberId));
  // Several members can be added at once; the action sends their booking ids comma-separated.
  const addedIds = typeof eklendi === "string" ? eklendi.split(",") : [];
  const added = roster.filter((row) => addedIds.includes(row.id) && row.status === "approved");
  const removed = typeof cikarildi === "string" ? roster.find((row) => row.id === cikarildi && row.status === "cancelled") : undefined;
  const upcoming = !hasStarted(lesson.startsAt);
  // Classes on an open day and on the hour can also become the added members' fixed weekly time.
  const slot = slotOf(lesson.startsAt);
  const fixable = isFixedSlotWeekday(slot.weekday) && isFixedSlotTime(slot.startTime);
  const fixedNotice = typeof sabit !== "string" ? null
    : sabit === "yok" ? "Bu ders sabit saat olabilecek bir saatte değil; üyeler yalnızca bu derse eklendi."
    : Number(sabit) === 0 ? `Seçtiğin üyeler zaten her hafta ${slotLabel(slot)} sabit.`
    : `${Number(sabit) > 1 ? `${sabit} üye` : "Üye"} artık her hafta ${slotLabel(slot)} sabit.${Number(ileri) ? ` Açık olan sonraki ${ileri} derse de eklendi${Number(sabit) > 1 ? "ler" : ""}.` : " Sonraki dersler açıldıkça otomatik eklenecek."}${Number(dolu) ? ` ${dolu} ders dolu olduğu için bekleme listesine alındı.` : ""}`;
  const active = roster.filter((row) => row.status === "approved" || row.status === "pending");
  const order = { approved: 0, pending: 1, cancelled: 2, rejected: 3 } as const;
  const rated = roster.filter((row) => row.status === "approved" && row.attendance !== "no_show" && row.effort !== null).map((row) => row.effort!);
  const averageEffort = rated.length ? (rated.reduce((sum, value) => sum + value, 0) / rated.length).toFixed(1) : null;
  // Attendance can be marked once the class has started.
  const marking = !upcoming && lesson.status === "published";
  // Upcoming class: a reminder to confirmed members; cancelled class: let the affected members know.
  const whatsapp = (row: (typeof roster)[number]) => {
    const topic = lesson.status === "cancelled" ? (row.status === "cancelled" ? "lessonCancelled" : null) : upcoming && row.status === "approved" ? "reminder" : null;
    return topic ? whatsappLink(row.memberPhone, whatsappMessage({ topic, memberName: row.memberName, trainerName: user.name, startsAt: lesson.startsAt, siteUrl: appUrl() })) : null;
  };

  return <AppShell className="roster-screen" nav={false}>
    <TopBar back={`/egitmen-paneli/takvim?gun=${dayKey(lesson.startsAt)}`} title="Ders listesi"/>
    <section>
      <div className="roster-head">
        <p className="eyebrow">Reformer · {lessonLevelLabels[lesson.level]}</p>
        <h1>{formatDayLong(lesson.startsAt)}<br/>{formatTime(lesson.startsAt)}</h1>
        {lesson.status === "cancelled" && <Notice>Bu ders iptal edildi. Üyelere e-posta gönderildi; aşağıdan WhatsApp&apos;tan da haber verebilirsin.</Notice>}
        <div className="detail-list">
          <InfoRow icon="users" label="Doluluk" value={`${lesson.taken}/${lesson.capacity} · ${Math.max(lesson.capacity - lesson.taken, 0)} yer boş`}/>
          <InfoRow icon="hourglass" label="Süre" value={`${lesson.durationMin} dk`}/>
          {marking && <InfoRow icon="level" label="Ortalama efor" value={averageEffort ? `${averageEffort}/10 · ${rated.length} kişi puanladı` : "Henüz puan yok"}/>}
          {lesson.note && <InfoRow icon="document" label="Not" value={lesson.note}/>}
        </div>
        {added.length === 1 && <div className="whatsapp-offer added-offer">
          <p><strong>{added[0].memberName} derse eklendi.</strong> E-posta ve bildirim gönderildi; WhatsApp&apos;tan da haber ver, mesaj hazır.</p>
          <WhatsAppLink href={whatsappLink(added[0].memberPhone, whatsappMessage({ topic: "added", memberName: added[0].memberName, trainerName: user.name, startsAt: lesson.startsAt, siteUrl: appUrl() }))} variant="button">WhatsApp&apos;tan Haber Ver</WhatsAppLink>
        </div>}
        {added.length > 1 && <div className="whatsapp-offer added-offer">
          <p><strong>{added.length} üye derse eklendi.</strong> Uygulamayı kullananlara e-posta ve bildirim gönderildi; istersen WhatsApp&apos;tan da haber ver.</p>
          <ul className="added-list">{added.map((row) => <li key={row.id}><span>{row.memberName}</span><WhatsAppLink href={whatsappLink(row.memberPhone, whatsappMessage({ topic: "added", memberName: row.memberName, trainerName: user.name, startsAt: lesson.startsAt, siteUrl: appUrl() }))}>WhatsApp</WhatsAppLink></li>)}</ul>
        </div>}
        {fixedNotice && <Notice tone={sabit === "yok" ? "neutral" : "success"}>{fixedNotice}</Notice>}
        {removed && <Notice tone="success">{removed.memberName} dersten çıkarıldı; üyeye bildirim gitti.{removed.fixedSlotId ? " Sabit saati sonraki haftalarda devam ediyor." : ""}</Notice>}
        {canAdd && <AddMemberForm lessonId={lesson.id} members={members.filter((member) => !inClass.has(member.id))} seatsLeft={Math.max(lesson.capacity - lesson.taken, 0)} fixedSlot={fixable ? slotLabel(slot) : null}/>}
        {duzenlendi === "1" && <Notice tone="success">Değişiklikler kaydedildi.</Notice>}
        {upcoming && lesson.status === "published" && <Link href={`/egitmen-paneli/dersler/${lesson.id}/duzenle`} className="see-all edit-lesson-link">Dersi düzenle<FlowlyIcon name="arrow-right" size={15}/></Link>}
        {upcoming && lesson.status === "published" && <CancelLessonForm lessonId={lesson.id} booked={active.length}/>}
      </div>
      <div className="roster-list">
        <h2>Katılımcılar</h2>
        {roster.length ? [...roster].sort((a, b) => order[a.status] - order[b.status]).map((row) => <div key={row.id} className={`roster-row${row.status === "cancelled" ? " is-cancelled" : ""}`}>
          <Avatar name={row.memberName} src={row.memberAvatar} size={44}/>
          <div><strong>{row.memberName}</strong>{row.memberPhone && <span className="roster-contact"><a href={`tel:${row.memberPhone}`}>{formatPhone(row.memberPhone)}</a><WhatsAppLink href={whatsapp(row)}>{lesson.status === "cancelled" ? "İptali bildir" : "Hatırlat"}</WhatsAppLink></span>}{row.memberNote && <q>{row.memberNote}</q>}{row.playlistUrl && <a href={row.playlistUrl} target="_blank" rel="noopener noreferrer" className="playlist-link"><FlowlyIcon name="music" size={14}/>Çalma listesi</a>}</div>
          {marking && row.status === "approved" ? <div className="roster-attendance">
            <AttendanceToggle bookingId={row.id} value={row.attendance}/>
            {row.effort !== null && row.attendance !== "no_show" && <span className="effort-pill" title="Üyenin efor puanı">Efor {row.effort}/10</span>}
          </div> : row.status === "pending" ? <Link href={`/egitmen-paneli/talepler/${row.id}`} className="see-all">Talebi incele<FlowlyIcon name="arrow-right" size={15}/></Link>
            : canAdd && row.status === "approved" ? <div className="roster-actions"><StatusBadge tone={bookingTone[row.status]} dot>{bookingStatusLabels[row.status]}</StatusBadge><RemoveFromLessonForm bookingId={row.id} memberName={row.memberName} fixed={Boolean(row.fixedSlotId)}/></div>
            : <StatusBadge tone={bookingTone[row.status]} dot>{bookingStatusLabels[row.status]}</StatusBadge>}
        </div>) : <EmptyState icon="users" title="Henüz katılımcı yok." text="Talepler geldikçe burada listelenecek."/>}
        {waiting.length > 0 && <div className="waitlist-roster">
          <h3>Bekleme listesi <span>{waiting.length} kişi</span></h3>
          <ol>{waiting.map((row) => <li key={row.id}><strong>{row.memberName}</strong>{row.memberPhone && <a href={`tel:${row.memberPhone}`}>{formatPhone(row.memberPhone)}</a>}</li>)}</ol>
          <p className="muted-note">Yer açıldığında hepsine bildirim gider; ilk talep gönderen yeri alır.</p>
        </div>}
      </div>
    </section>
  </AppShell>;
}
