import { atStudioTime, formatDayMonth } from "@/lib/format";
import { remainingOf, type PackageState } from "@/lib/package-rules";
import { StatusBadge } from "./ui";

const day = (key: string) => formatDayMonth(atStudioTime(key, "12:00"));

/** One-line package status for trainers (member list, request detail). */
export function PackageBadge({ state }: { state: PackageState }) {
  switch (state.kind) {
    case "active": return <StatusBadge tone="moss">{`${state.remaining} ders kaldı · son gün ${day(state.pkg.endsOn)}`}</StatusBadge>;
    case "upcoming": return <StatusBadge tone="blue">{`Paketi ${day(state.pkg.startsOn)} başlıyor`}</StatusBadge>;
    case "exhausted": return <StatusBadge tone="plum">Paketi bitti</StatusBadge>;
    case "expired": return <StatusBadge tone="plum">Paket süresi doldu</StatusBadge>;
    default: return <StatusBadge tone="neutral">Paket yok</StatusBadge>;
  }
}

/** The member's own package on the profile page: lessons left, last day and a progress bar. */
export function PackageCard({ state }: { state: PackageState }) {
  const text = (() => {
    switch (state.kind) {
      case "active": return { title: `${state.remaining} ders kaldı`, detail: `${state.pkg.lessonCount} derslik paketinden ${state.pkg.used} ders kullandın · Son gün ${day(state.pkg.endsOn)}` };
      case "upcoming": return { title: "Yeni paketin hazır", detail: `${state.pkg.lessonCount} ders · ${day(state.pkg.startsOn)} – ${day(state.pkg.endsOn)}` };
      case "exhausted": return { title: "Paketindeki dersler bitti", detail: "Yeni paket için stüdyoyla görüş. Talep göndermeye devam edebilirsin; eğitmenin onaylar." };
      case "expired": return { title: "Paketinin süresi doldu", detail: `Son gün ${day(state.pkg.endsOn)}${state.remaining ? ` · ${state.remaining} ders kullanılmadan kaldı` : ""}. Yeni paket için stüdyoyla görüş.` };
      default: return { title: "Tanımlı paketin yok", detail: "Stüdyodan paket aldığında eğitmenin buraya ekler; kalan derslerini buradan takip edersin." };
    }
  })();
  const pkg = state.kind === "none" ? null : state.pkg;
  const used = pkg ? pkg.lessonCount - remainingOf(pkg) : 0;
  return <div className={`package-card is-${state.kind}`}>
    <p className="eyebrow">Ders paketin</p>
    <strong>{text.title}</strong>
    <p>{text.detail}</p>
    {pkg && state.kind !== "upcoming" && <div className="package-bar" role="progressbar" aria-label="Kullanılan ders" aria-valuemin={0} aria-valuemax={pkg.lessonCount} aria-valuenow={used}>
      <i style={{ width: `${Math.min(100, (used / pkg.lessonCount) * 100)}%` }}/>
    </div>}
  </div>;
}
