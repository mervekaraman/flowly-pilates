import Link from "next/link";
import { FlowlyIcon } from "@/components/flowly/icons";
import { AppShell } from "@/components/flowly/shell";
import { EmptyState, Notice, StatusBadge } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";
import { addDays, atStudioTime, dayRange, formatDayLong, formatMonthYear, formatTime, isDayKey, isSunday, lessonLevelLabels, todayKey } from "@/lib/format";
import { listLessons, trainerLessonDays } from "@/lib/queries";

export const metadata = { title: "Ders takvimi" };

const weekdays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function shiftMonth(month: string, amount: number) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function TrainerCalendarPage({ searchParams }: PageProps<"/egitmen-paneli/takvim">) {
  const user = await requireUser({ role: "trainer", next: "/egitmen-paneli/takvim" });
  const params = await searchParams;
  const today = todayKey();
  const selectedParam = isDayKey(params.gun) ? params.gun : undefined;
  const month = typeof params.ay === "string" && /^(20[2-9]\d)-(0[1-9]|1[0-2])$/.test(params.ay) ? params.ay : (selectedParam ?? today).slice(0, 7);
  const lessonDays = await trainerLessonDays(user.id, month);
  const selected = selectedParam && selectedParam.startsWith(month) ? selectedParam : today.startsWith(month) ? today : [...lessonDays].sort()[0] ?? `${month}-01`;
  const [start, end] = dayRange(selected);
  const lessons = await listLessons({ from: start, to: end, trainerId: user.id, includeCancelled: true });

  const first = `${month}-01`;
  const lead = (atStudioTime(first, "12:00").getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((lead + daysInMonth) / 7) * 7 }, (_, index) => addDays(first, index - lead));

  return <AppShell className="trainer-calendar-screen">
    <section>
      <div className="dashboard-head"><h1>Ders takvimi</h1><Link href={`/egitmen-paneli/yeni-ders?gun=${selected}`} className="new-time"><i><FlowlyIcon name="plus"/></i>Yeni saat</Link></div>
      {typeof params.yeni === "string" && <Notice tone="success">{params.yeni === "1" ? "Ders yayınlandı; programda görünüyor." : `${params.yeni} haftalık ders yayınlandı.`}</Notice>}
      {typeof params.iptal === "string" && <Notice tone="success">{params.iptal === "0" ? "Ders iptal edildi." : `Ders iptal edildi; rezervasyonu olan ${params.iptal} üyeye e-postayla haber verildi.`}</Notice>}
      <div className="calendar-layout">
        <div className="calendar-card">
          <div className="calendar-month"><Link href={`/egitmen-paneli/takvim?ay=${shiftMonth(month, -1)}`} aria-label="Önceki ay"><FlowlyIcon name="chevron-left" size={20}/></Link><strong>{formatMonthYear(atStudioTime(first, "12:00"))}</strong><Link href={`/egitmen-paneli/takvim?ay=${shiftMonth(month, 1)}`} aria-label="Sonraki ay"><FlowlyIcon name="chevron-right" size={20}/></Link></div>
          <div className="calendar-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid">{cells.map((day) => <Link key={day} href={`/egitmen-paneli/takvim?ay=${month}&gun=${day}`} scroll={false}
            className={[day === selected && "is-selected", !day.startsWith(month) && "is-muted", day === today && "is-today", isSunday(day) && "is-closed"].filter(Boolean).join(" ")}
            aria-current={day === selected ? "date" : undefined} aria-label={`${formatDayLong(atStudioTime(day, "12:00"))}${lessonDays.has(day) ? ", dersin var" : ""}`}>
            {Number(day.slice(8))}{lessonDays.has(day) && <i/>}
          </Link>)}</div>
        </div>
        <div>
          <div className="section-title-row"><h2>{formatDayLong(atStudioTime(selected, "12:00"))}</h2></div>
          {lessons.length ? <div className="timeline">{lessons.map((lesson) => <Link key={lesson.id} href={`/egitmen-paneli/dersler/${lesson.id}`} className={lesson.status === "cancelled" ? "is-cancelled" : ""}>
            <time>{formatTime(lesson.startsAt)}</time>
            <div><strong>Reformer · {lessonLevelLabels[lesson.level]}</strong><span>{lesson.durationMin} dk · {lesson.taken}/{lesson.capacity} katılımcı</span></div>
            {lesson.status === "cancelled" ? <StatusBadge tone="neutral">İptal</StatusBadge> : lesson.taken >= lesson.capacity ? <StatusBadge tone="plum">Dolu</StatusBadge> : <span/>}
            <FlowlyIcon name="chevron-right" size={18}/>
          </Link>)}</div>
            : <EmptyState icon="calendar" title={isSunday(selected) ? "Pazar günleri ders açılmıyor." : "Bu gün için dersin yok."} action={!isSunday(selected) && selected >= today ? <Link href={`/egitmen-paneli/yeni-ders?gun=${selected}`} className="see-all">Bu güne ders aç<FlowlyIcon name="arrow-right" size={15}/></Link> : undefined}/>}
        </div>
      </div>
    </section>
  </AppShell>;
}
