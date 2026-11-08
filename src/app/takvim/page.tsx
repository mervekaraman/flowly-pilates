import Link from "next/link";
import { redirect } from "next/navigation";
import { FlowlyIcon } from "@/components/flowly/icons";
import { LessonRow } from "@/components/flowly/lessons";
import { DayMotion } from "@/components/flowly/motion";
import { AppShell } from "@/components/flowly/shell";
import { Avatar, bookingTone, EmptyState, PageHeading, StatusBadge } from "@/components/flowly/ui";
import { getCurrentUser, requireUser } from "@/lib/dal";
import { addDays, atStudioTime, bookingStatusLabels, dayKey, dayRange, formatDayLong, formatMonthYear, formatTime, isDayKey, isSunday, lessonLevelLabels, lessonTypeLabels, notBeforeNow, shiftMonth, todayKey } from "@/lib/format";
import { listLessons, listMemberBookings, studioLessonDays } from "@/lib/queries";

export const metadata = { title: "Takvim" };

const weekdays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/**
 * The member's month at a glance: which days have classes, which days they are booked on, and the
 * classes of the chosen day. Only the studio's own schedule and the member's own bookings are shown;
 * nobody else's name or booking appears here.
 */
export default async function MemberCalendarPage({ searchParams }: PageProps<"/takvim">) {
  const params = await searchParams;
  // Trainers have their own calendar with rosters (and /takvim used to lead there).
  const viewer = await getCurrentUser();
  if (viewer?.role === "trainer") redirect(`/egitmen-paneli/takvim${isDayKey(params.gun) ? `?gun=${params.gun}` : ""}`);
  const user = await requireUser({ role: "member", next: "/takvim" });

  const today = todayKey();
  const selectedParam = isDayKey(params.gun) ? params.gun : undefined;
  const month = typeof params.ay === "string" && /^(20[2-9]\d)-(0[1-9]|1[0-2])$/.test(params.ay) ? params.ay : (selectedParam ?? today).slice(0, 7);
  const [lessonDays, bookings] = await Promise.all([studioLessonDays(month), listMemberBookings(user.id)]);
  // Days the member holds a seat on (a request still waiting counts too).
  const myDays = new Set(bookings.filter((booking) => booking.status === "pending" || booking.status === "approved").map((booking) => dayKey(booking.startsAt)));
  // Without a chosen day, open on today if it still has classes, otherwise on the month's next class day.
  const firstLessonDay = [...lessonDays].filter((day) => day >= today).sort()[0];
  const selected = selectedParam && selectedParam.startsWith(month) ? selectedParam : today.startsWith(month) && lessonDays.has(today) ? today : firstLessonDay ?? (today.startsWith(month) ? today : `${month}-01`);
  const past = selected < today;
  const [start, end] = dayRange(selected);
  // Past days list the member's own classes; today and later list what can still be booked.
  const lessons = past ? [] : await listLessons({ from: notBeforeNow(start), to: end, viewerId: user.id });
  const pastBookings = past ? bookings.filter((booking) => dayKey(booking.startsAt) === selected) : [];

  const first = `${month}-01`;
  const lead = (atStudioTime(first, "12:00").getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((lead + daysInMonth) / 7) * 7 }, (_, index) => addDays(first, index - lead));
  const towards = (day: string) => [day > selected ? "day-next" : "day-prev"];

  return <AppShell className="trainer-calendar-screen member-calendar-screen">
    <section>
      <PageHeading eyebrow="Takvim" title="Ders takvimi" sub="Ayın derslerini ve kendi rezervasyonlarını bir bakışta gör."/>
      <div className="calendar-layout">
        <div className="calendar-card">
          <div className="calendar-month">
            <Link href={`/takvim?ay=${shiftMonth(month, -1)}`} scroll={false} transitionTypes={["day-prev"]} aria-label="Önceki ay"><FlowlyIcon name="chevron-left" size={20}/></Link>
            <strong>{formatMonthYear(atStudioTime(first, "12:00"))}</strong>
            <Link href={`/takvim?ay=${shiftMonth(month, 1)}`} scroll={false} transitionTypes={["day-next"]} aria-label="Sonraki ay"><FlowlyIcon name="chevron-right" size={20}/></Link>
          </div>
          <div className="calendar-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid">{cells.map((day) => {
            const mine = myDays.has(day);
            const open = !mine && day >= today && lessonDays.has(day);
            return <Link key={day} href={`/takvim?ay=${day.slice(0, 7)}&gun=${day}`} scroll={false} transitionTypes={towards(day)}
              className={[day === selected && "is-selected", !day.startsWith(month) && "is-muted", day === today && "is-today", isSunday(day) && "is-closed"].filter(Boolean).join(" ")}
              aria-current={day === selected ? "date" : undefined} aria-label={`${formatDayLong(atStudioTime(day, "12:00"))}${mine ? ", rezervasyonun var" : open ? ", ders var" : ""}`}>
              {Number(day.slice(8))}{mine ? <i className="is-mine"/> : open && <i/>}
            </Link>;
          })}</div>
          <div className="calendar-legend"><span><i/>Ders var</span><span><i className="is-mine"/>Rezervasyonun</span></div>
        </div>
        <DayMotion day={selected}><div>
          <div className="section-title-row"><h2>{formatDayLong(atStudioTime(selected, "12:00"))}</h2></div>
          {past
            ? pastBookings.length
              ? <div className="lesson-list">{pastBookings.map((booking) => <Link key={booking.id} href={`/rezervasyonlar/${booking.id}`} className="lesson-row">
                <div className="lesson-time"><strong>{formatTime(booking.startsAt)}</strong><span>{booking.durationMin} dk</span></div>
                <div className="lesson-main">
                  <strong>{lessonTypeLabels[booking.type]}</strong>
                  <span><span>{lessonLevelLabels[booking.level]}</span><span className="lesson-trainer"><Avatar name={booking.trainerName} src={booking.trainerAvatar} size={20}/>{booking.trainerName}</span></span>
                </div>
                {booking.attendance === "attended" ? <StatusBadge tone="moss" dot>Katıldın</StatusBadge> : <StatusBadge tone={bookingTone[booking.status]}>{bookingStatusLabels[booking.status]}</StatusBadge>}
                <FlowlyIcon name="chevron-right" size={18}/>
              </Link>)}</div>
              : <EmptyState icon="calendar" title={isSunday(selected) ? "Pazar günleri stüdyo kapalı." : "Bu gün dersin yoktu."}/>
            : lessons.length
              ? <div className="lesson-list">{lessons.map((lesson) => <LessonRow key={lesson.id} lesson={lesson} href={`/dersler/${lesson.id}`}/>)}</div>
              : <EmptyState icon="calendar" title={isSunday(selected) ? "Pazar günleri stüdyo kapalı." : "Bu gün için açık ders yok."} action={!isSunday(selected) ? <Link href="/dersler" className="see-all">Ders programına git<FlowlyIcon name="arrow-right" size={15}/></Link> : undefined}/>}
        </div></DayMotion>
      </div>
    </section>
  </AppShell>;
}
