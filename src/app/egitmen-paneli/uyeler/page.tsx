import Link from "next/link";
import { FlowlyIcon } from "@/components/flowly/icons";
import { AppShell } from "@/components/flowly/shell";
import { Avatar, EmptyState, WhatsAppLink } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";
import { formatDayMonth } from "@/lib/format";
import { formatPhone } from "@/lib/forms";
import { listMemberOverview } from "@/lib/queries";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata = { title: "Üyeler" };

export default async function MembersPage({ searchParams }: PageProps<"/egitmen-paneli/uyeler">) {
  const user = await requireUser({ role: "trainer", next: "/egitmen-paneli/uyeler" });
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.slice(0, 60) : "";
  const members = await listMemberOverview(search);
  const trainerFirst = user.name.split(" ")[0];

  return <AppShell className="members-screen">
    <section>
      <h1>Üyeler</h1>
      <form className="member-search" role="search">
        <label><FlowlyIcon name="search" size={20}/><input type="search" name="q" defaultValue={search} placeholder="Ad, telefon ya da e-posta" aria-label="Üye ara"/></label>
        {search && <Link href="/egitmen-paneli/uyeler" className="text-link">Temizle</Link>}
      </form>
      <p className="muted-note">{members.length} üye{search ? ` · “${search}” araması` : ""}</p>
      {members.length ? <div className="member-list">{members.map((member) => <article key={member.id}>
        <Avatar name={member.name} src={member.avatarUrl} size={52}/>
        <div className="member-main">
          <strong>{member.name}</strong>
          <span>{member.phone && <a href={`tel:${member.phone}`}>{formatPhone(member.phone)}</a>}<a href={`mailto:${member.email}`}>{member.email}</a></span>
          <span className="member-stats">
            <span>{member.completed} ders</span>
            {member.upcoming > 0 && <span>{member.upcoming} yaklaşan</span>}
            {member.noShows > 0 && <span className="is-warning">{member.noShows} gelmedi</span>}
            {member.averageEffort !== null && <span>Efor {member.averageEffort}/10</span>}
            <span>{member.lastLesson ? `Son ders ${formatDayMonth(member.lastLesson)}` : `Üye ${formatDayMonth(member.joinedAt)}`}</span>
          </span>
        </div>
        <WhatsAppLink href={whatsappLink(member.phone, `Merhaba ${member.name.split(" ")[0]},\n\n${trainerFirst} · Flowly Pilates`)}>WhatsApp</WhatsAppLink>
      </article>)}</div> : <EmptyState icon="users" title={search ? "Bu aramayla eşleşen üye yok." : "Henüz üye yok."} text={search ? undefined : "Üyeler uygulamaya kayıt oldukça burada listelenecek."}/>}
    </section>
  </AppShell>;
}
