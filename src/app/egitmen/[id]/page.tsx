import { notFound } from "next/navigation";
import { LessonRow } from "@/components/flowly/lessons";
import { AppShell } from "@/components/flowly/shell";
import { Avatar, ButtonLink, Rating, SectionTitle, SeeAll, Stars, TopBar } from "@/components/flowly/ui";
import { getCurrentUser } from "@/lib/dal";
import { formatDayLong, formatDayMonth, fromNow } from "@/lib/format";
import { getTrainer, listLessons, listReviews } from "@/lib/queries";
import { studio } from "@/lib/studio";

export const metadata = { title: "Eğitmen" };

export default async function TrainerProfilePage({ params }: PageProps<"/egitmen/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const trainer = await getTrainer(id);
  if (!trainer) notFound();
  const [lessons, reviews] = await Promise.all([
    listLessons({ from: fromNow(), to: fromNow(14), trainerId: trainer.id, viewerId: user?.role === "member" ? user.id : undefined }),
    user?.role === "trainer" ? listReviews({ trainerId: trainer.id, limit: 4 }) : [],
  ]);

  return <AppShell className="instructor-screen">
    <TopBar back="/hakkimizda" title="Eğitmen"/>
    <section>
      <header className="instructor-head">
        <Avatar name={trainer.name} src={trainer.avatarUrl} size={140}/>
        <h1>{trainer.name}</h1>
        <p className="subtitle">Reformer eğitmeni · {studio.name}</p>
        <div className="instructor-meta"><Rating value={trainer.rating} count={trainer.reviewCount || undefined}/></div>
        {trainer.bio && <blockquote>{trainer.bio}</blockquote>}
      </header>
      <div className="instructor-about">
        <SectionTitle title="Üyelerin yorumları" action={reviews.length ? <SeeAll href="/yorumlar">Tüm yorumlar</SeeAll> : undefined}/>
        {user?.role !== "trainer" ? <p className="muted-note">Yorumlar yalnızca stüdyo ekibiyle paylaşılır. {trainer.reviewCount ? `${trainer.reviewCount} değerlendirmenin ortalaması yukarıda.` : ""}</p>
          : reviews.length ? <div className="review-list">{reviews.map((review) => <article key={review.id}><Avatar name={review.memberName} src={review.memberAvatar} size={44}/><div><div><strong>{review.memberName}</strong><time>{formatDayMonth(review.createdAt)}</time></div><Stars value={review.rating}/><p>{review.comment}</p></div></article>)}</div>
          : <p className="muted-note">{trainer.name.split(" ")[0]} için henüz yorum yapılmadı.</p>}
      </div>
      <aside className="instructor-classes">
        <SectionTitle title="Yaklaşan dersleri"/>
        {lessons.length ? <div className="lesson-list is-compact">{lessons.slice(0, 6).map((lesson, index, list) => <div key={lesson.id}>{(index === 0 || formatDayLong(list[index - 1].startsAt) !== formatDayLong(lesson.startsAt)) && <p className="list-day">{formatDayLong(lesson.startsAt)}</p>}<LessonRow lesson={lesson} href={`/dersler/${lesson.id}`} showTrainer={false}/></div>)}</div>
          : <p className="muted-note">Önümüzdeki iki hafta için açılmış dersi yok.</p>}
        <ButtonLink href="/dersler">Tüm Programı Gör</ButtonLink>
      </aside>
    </section>
  </AppShell>;
}
