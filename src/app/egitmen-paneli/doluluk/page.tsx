import Link from "next/link";
import { AppShell } from "@/components/flowly/shell";
import { EmptyState, PageHeading, TopBar } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";
import { occupancyGrid, weekdayLong, weekdayShort } from "@/lib/occupancy";
import { isUuid, listTrainers, occupancyLessons } from "@/lib/queries";

export const metadata = { title: "Doluluk özeti" };

const periods = [4, 8, 12] as const;
const percent = (rate: number) => `%${Math.round(rate * 100)}`;

/**
 * Which weekdays and hours fill up and which stay empty, over the last few weeks, for the whole
 * studio or one trainer. Occupancy = approved seats / capacity of past, published classes.
 */
export default async function OccupancyPage({ searchParams }: PageProps<"/egitmen-paneli/doluluk">) {
  await requireUser({ role: "trainer", next: "/egitmen-paneli/doluluk" });
  const params = await searchParams;
  const weeks = periods.find((value) => String(value) === params.hafta) ?? 8;
  const trainers = await listTrainers();
  const trainerId = typeof params.egitmen === "string" && isUuid(params.egitmen) && trainers.some((trainer) => trainer.id === params.egitmen) ? params.egitmen : undefined;
  const grid = occupancyGrid(await occupancyLessons({ weeks, trainerId }));
  // The studio is closed on Sundays; the column appears only if a Sunday class ever took place.
  const days = grid.times.some((time) => grid.cell(7, time)) ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6];
  const href = (next: { hafta?: number; egitmen?: string | null }) => {
    const query = new URLSearchParams();
    const hafta = next.hafta ?? weeks;
    if (hafta !== 8) query.set("hafta", String(hafta));
    const egitmen = next.egitmen === undefined ? trainerId : next.egitmen;
    if (egitmen) query.set("egitmen", egitmen);
    return `/egitmen-paneli/doluluk${query.size ? `?${query}` : ""}`;
  };
  const slotLabel = (slot: { weekday: number; time: string }) => `${weekdayLong[slot.weekday]} ${slot.time}`;

  return <AppShell className="occupancy-screen">
    <TopBar back="/egitmen-paneli" title="Doluluk özeti"/>
    <section>
      <PageHeading eyebrow="Eğitmen paneli" title="Doluluk" sub={`Son ${weeks} haftada hangi gün ve saatler doldu, hangileri boş kaldı.`}/>
      <div className="tab-row small" role="tablist" aria-label="Dönem">{periods.map((value) => <Link key={value} href={href({ hafta: value })} scroll={false} role="tab" aria-selected={value === weeks} className={value === weeks ? "is-active" : ""}>{value} hafta</Link>)}</div>
      {trainers.length > 1 && <nav className="occupancy-filter" aria-label="Eğitmen">
        <Link href={href({ egitmen: null })} scroll={false} className={!trainerId ? "is-active" : ""} aria-current={!trainerId ? "true" : undefined}>Tüm stüdyo</Link>
        {trainers.map((trainer) => <Link key={trainer.id} href={href({ egitmen: trainer.id })} scroll={false} className={trainerId === trainer.id ? "is-active" : ""} aria-current={trainerId === trainer.id ? "true" : undefined}>{trainer.name.split(" ")[0]}</Link>)}
      </nav>}

      {grid.totalLessons === 0
        ? <EmptyState icon="calendar" title="Bu dönemde geçmiş ders yok." text="Dersler yapıldıkça doluluk burada görünecek."/>
        : <>
          <div className="occupancy-stats">
            <div><strong>{percent(grid.overall)}</strong><span>Ortalama doluluk</span></div>
            <div><strong>{grid.totalLessons}</strong><span>Ders</span></div>
            <div><strong>{grid.totalTaken}</strong><span>Onaylı katılım</span></div>
          </div>
          <div className="occupancy-highlights">
            {grid.busiest && <p><span className="occupancy-dot is-full"/>En dolu: <strong>{slotLabel(grid.busiest)}</strong> · {percent(grid.busiest.rate)}</p>}
            {grid.quietest && <p><span className="occupancy-dot"/>En boş: <strong>{slotLabel(grid.quietest)}</strong> · {percent(grid.quietest.rate)}</p>}
          </div>
          <div className="occupancy-table-wrap">
            <table className="occupancy-table">
              <caption className="sr-only">Gün ve saate göre ortalama doluluk</caption>
              <thead><tr><th scope="col"><span className="sr-only">Saat</span></th>{days.map((day) => <th key={day} scope="col">{weekdayShort[day]}</th>)}</tr></thead>
              <tbody>{grid.times.map((time) => <tr key={time}>
                <th scope="row">{time}</th>
                {days.map((day) => {
                  const cell = grid.cell(day, time);
                  if (!cell) return <td key={day} className="is-empty"><span aria-hidden="true">·</span><span className="sr-only">Ders yok</span></td>;
                  return <td key={day} style={{ "--rate": cell.rate } as React.CSSProperties} className={cell.rate >= 0.55 ? "is-strong" : undefined}
                    title={`${weekdayLong[day]} ${time}: ${cell.lessons} ders, ${cell.taken}/${cell.capacity} yer dolu`}>
                    <strong>{percent(cell.rate)}</strong><small>{cell.lessons} ders</small>
                  </td>;
                })}
              </tr>)}</tbody>
            </table>
          </div>
          <div className="occupancy-legend" aria-hidden="true"><span>Boş</span><i/><span>Dolu</span></div>
          <p className="muted-note">Doluluk, geçmiş derslerde onaylı katılımcı sayısının kontenjana oranıdır. İptal edilen dersler ve bekleyen talepler sayılmaz.</p>
        </>}
    </section>
  </AppShell>;
}
