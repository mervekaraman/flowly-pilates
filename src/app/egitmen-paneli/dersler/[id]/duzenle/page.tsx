import { notFound, redirect } from "next/navigation";
import { EditLessonForm } from "@/components/flowly/forms";
import { AppShell } from "@/components/flowly/shell";
import { TopBar } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";
import { formatDayLong, formatTime, hasStarted } from "@/lib/format";
import { getTrainerLesson } from "@/lib/queries";

export const metadata = { title: "Dersi düzenle" };

export default async function EditLessonPage({ params }: PageProps<"/egitmen-paneli/dersler/[id]/duzenle">) {
  const { id } = await params;
  const user = await requireUser({ role: "trainer", next: `/egitmen-paneli/dersler/${id}/duzenle` });
  const data = await getTrainerLesson(id, user.id);
  if (!data) notFound();
  const { lesson } = data;
  if (lesson.status !== "published" || hasStarted(lesson.startsAt)) redirect(`/egitmen-paneli/dersler/${id}`);

  return <AppShell className="new-class-screen" nav={false}>
    <TopBar back={`/egitmen-paneli/dersler/${id}`}/>
    <section>
      <h1>Dersi düzenle</h1>
      <p>{formatDayLong(lesson.startsAt)}, {formatTime(lesson.startsAt)}. Gün ve saat değişmez; farklı bir saat için bu dersi iptal edip yeni saat aç.</p>
      <EditLessonForm lesson={{ id: lesson.id, durationMin: lesson.durationMin, capacity: lesson.capacity, level: lesson.level, note: lesson.note, taken: lesson.taken }}/>
    </section>
  </AppShell>;
}
