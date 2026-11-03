import Link from "next/link";
import { AppShell } from "@/components/flowly/shell";
import { Avatar, ButtonLink, EmptyState, Notice, Stars, TopBar } from "@/components/flowly/ui";
import { getCurrentUser } from "@/lib/dal";
import { formatDayMonth } from "@/lib/format";
import { listReviews, reviewSummary, type ReviewSort } from "@/lib/queries";

export const metadata = { title: "Yorumlar" };

export default async function ReviewsPage({ searchParams }: PageProps<"/yorumlar">) {
  const params = await searchParams;
  const sort: ReviewSort = params.sirala === "yuksek" ? "yuksek" : "yeni";
  const user = await getCurrentUser();
  const trainer = user?.role === "trainer";
  const [summary, list] = await Promise.all([reviewSummary(), user ? listReviews({ sort, memberId: trainer ? undefined : user.id }) : []]);

  return <AppShell className="reviews-screen">
    <TopBar back="/hakkimizda" title="Yorumlar"/>
    <section>
      <div className="rating-summary">
        <div><strong>{summary.average?.toFixed(1) ?? "–"}</strong><Stars value={Math.round(summary.average ?? 0)}/><span>{summary.count} değerlendirme</span></div>
        <div className="rating-bars">{[5, 4, 3, 2, 1].map((star) => <div key={star}><span>{star}</span><i><b style={{ width: `${summary.count ? (summary.distribution[star] / summary.count) * 100 : 0}%` }}/></i><em>{summary.distribution[star]}</em></div>)}</div>
        {user?.role === "member" && <div className="rating-cta"><p>Katıldığın bir dersi değerlendirmek için geçmiş rezervasyonlarına göz at.</p><ButtonLink href="/rezervasyonlar?sekme=gecmis" variant="outline">Dersimi Değerlendir</ButtonLink></div>}
      </div>
      <div className="reviews-main">
        {params.gonderildi === "1" && <Notice tone="success">Yorumun stüdyoya iletildi. Teşekkürler!</Notice>}
        {!trainer && <p className="muted-note">Yorumlar yalnızca stüdyo ekibiyle paylaşılır; herkes yalnızca puan ortalamasını görür.{user ? " Aşağıda kendi yorumların var." : ""}</p>}
        {user && <><div className="tab-row small" role="tablist">
          <Link href="/yorumlar" role="tab" aria-selected={sort === "yeni"} className={sort === "yeni" ? "is-active" : ""}>En yeni</Link>
          <Link href="/yorumlar?sirala=yuksek" role="tab" aria-selected={sort === "yuksek"} className={sort === "yuksek" ? "is-active" : ""}>En yüksek puan</Link>
        </div>
        {list.length ? <div className="review-list">{list.map((review) => <article key={review.id}>
          <Avatar name={review.memberName} src={review.memberAvatar} size={52}/>
          <div><div><strong>{review.memberName}</strong><time dateTime={review.createdAt.toISOString()}>{formatDayMonth(review.createdAt)}</time></div><Stars value={review.rating}/><p>{review.comment}</p><Link href={`/egitmen/${review.trainerId}`} className="review-trainer">Eğitmen: {review.trainerName}</Link></div>
        </article>)}</div> : <EmptyState icon="star" title={trainer ? "Henüz yorum yok." : "Henüz yorum yazmadın."} text={trainer ? "Derslere katılan üyelerin değerlendirmeleri burada görünecek." : "Katıldığın bir dersi değerlendirdiğinde yorumun burada görünür."}/>}</>}
      </div>
    </section>
  </AppShell>;
}
