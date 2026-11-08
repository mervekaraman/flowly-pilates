import Link from "next/link";
import { addDays, atStudioTime, dayParts, formatTime, lessonLevelLabels, lessonTypeLabels, todayKey } from "@/lib/format";
import type { DayCount, LessonCard } from "@/lib/queries";
import { FlowlyIcon } from "./icons";
import { Avatar, StatusBadge } from "./ui";

export function seatsLeft(lesson: Pick<LessonCard, "capacity" | "taken">) {
  return Math.max(lesson.capacity - lesson.taken, 0);
}

/** One badge that answers "can I still get in?" from the viewer's point of view. */
export function SeatBadge({ lesson }: { lesson: Pick<LessonCard, "capacity" | "taken" | "myStatus" | "status"> }) {
  if (lesson.status === "cancelled") return <StatusBadge tone="neutral">İptal edildi</StatusBadge>;
  if (lesson.myStatus === "approved") return <StatusBadge tone="moss" dot>Yerin ayrıldı</StatusBadge>;
  if (lesson.myStatus === "pending") return <StatusBadge tone="blue" dot>Talebin var</StatusBadge>;
  const left = seatsLeft(lesson);
  if (left === 0) return <StatusBadge tone="plum">Dolu</StatusBadge>;
  if (left <= 2) return <StatusBadge tone="blue">Son {left} yer</StatusBadge>;
  return <StatusBadge tone="neutral">{left} yer</StatusBadge>;
}

export function LessonRow({ lesson, href, showTrainer = true }: { lesson: LessonCard; href: string; showTrainer?: boolean }) {
  return <Link href={href} className="lesson-row">
    <div className="lesson-time"><strong>{formatTime(lesson.startsAt)}</strong><span>{lesson.durationMin} dk</span></div>
    <div className="lesson-main">
      <strong>{lessonTypeLabels[lesson.type]}</strong>
      <span><span>{lessonLevelLabels[lesson.level]}</span>{showTrainer && <span className="lesson-trainer"><Avatar name={lesson.trainerName} src={lesson.trainerAvatar} size={20}/>{lesson.trainerName}</span>}</span>
    </div>
    <SeatBadge lesson={lesson}/>
    <FlowlyIcon name="chevron-right" size={18}/>
  </Link>;
}

function dayLabel(day: string) {
  const today = todayKey();
  if (day === today) return "Bugün";
  if (day === addDays(today, 1)) return "Yarın";
  return dayParts(atStudioTime(day, "12:00")).weekday;
}

export function DateStrip({ days, selected, counts, hrefFor }: { days: string[]; selected: string; counts?: Record<string, DayCount>; hrefFor: (day: string) => string }) {
  return <nav className="date-strip" aria-label="Gün seç">{days.map((day) => {
    const parts = dayParts(atStudioTime(day, "12:00"));
    const count = counts?.[day];
    return <Link key={day} href={hrefFor(day)} scroll={false} transitionTypes={[day > selected ? "day-next" : "day-prev"]} className={day === selected ? "is-selected" : ""} aria-current={day === selected ? "date" : undefined}>
      <span>{dayLabel(day)}</span><strong>{Number(parts.day)}</strong><small>{parts.month.charAt(0) + parts.month.slice(1).toLocaleLowerCase("tr-TR")}</small>
      {counts && <em className={count?.open ? "" : "is-empty"}>{!count?.total ? "Ders yok" : count.open ? `${count.open} ders` : "Dolu"}</em>}
    </Link>;
  })}</nav>;
}
