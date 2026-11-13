import { FlowlyIcon } from "./icons";
import { earnedMilestones, milestoneLabel, nextMilestone } from "@/lib/milestones";

/** Member profile: classes this month and class-count badges (bordo medallions; the next one locked). */
export function ProgressCard({ total, thisMonth }: { total: number; thisMonth: number }) {
  const earned = earnedMilestones(total);
  const next = nextMilestone(total);
  const previous = earned.at(-1) ?? 0;
  const left = next - total;
  return <div className="package-card progress-card">
    <p className="eyebrow">Rozetlerin</p>
    <strong>Bu ay {thisMonth} ders</strong>
    <p>{total === 0 ? "İlk dersine katıldığında ilk rozetini kazanacaksın." : `Toplam ${total} ders · ${milestoneLabel(next)} rozetine ${left} ders kaldı.`}</p>
    <div className="package-bar" role="progressbar" aria-label={`${milestoneLabel(next)} rozetine ilerleme`} aria-valuemin={previous} aria-valuemax={next} aria-valuenow={total}>
      <i style={{ width: `${Math.min(100, ((total - previous) / (next - previous)) * 100)}%` }}/>
    </div>
    <ul className="badge-row" aria-label="Rozetler">
      {earned.map((m) => <li key={m} className="is-earned"><span>{m}</span>{milestoneLabel(m)}</li>)}
      <li className="is-next" aria-label={`Sıradaki rozet: ${milestoneLabel(next)}`}><span><FlowlyIcon name="lock" size={18}/></span>{milestoneLabel(next)}</li>
    </ul>
  </div>;
}
