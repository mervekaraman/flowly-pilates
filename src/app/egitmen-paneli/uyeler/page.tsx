import { MemberFilter } from "@/components/flowly/member-filter";
import { AddPlaceholderForm, MergeMemberForm } from "@/components/flowly/member-forms";
import { PackageEditor } from "@/components/flowly/package-forms";
import { PackageBadge } from "@/components/flowly/packages";
import { AppShell } from "@/components/flowly/shell";
import { Avatar, EmptyState, Notice, StatusBadge, WhatsAppLink } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";
import { formatDayMonth, todayKey } from "@/lib/format";
import { formatPhone } from "@/lib/forms";
import { packageState } from "@/lib/package-rules";
import { listMemberOverview, listPackages } from "@/lib/queries";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata = { title: "Üyeler" };

export default async function MembersPage({ searchParams }: PageProps<"/egitmen-paneli/uyeler">) {
  const user = await requireUser({ role: "trainer", next: "/egitmen-paneli/uyeler" });
  const [members, packages, params] = await Promise.all([listMemberOverview(), listPackages(), searchParams]);
  const merged = params.birlesti === "1"
    ? `Hesaplar birleştirildi: ${Number(params.rez) || 0} rezervasyon, ${Number(params.paket) || 0} paket ve ${Number(params.sabit) || 0} sabit saat üyenin hesabına taşındı.` : null;
  const today = todayKey();
  const packagesOf = (memberId: string) => packages.filter((pkg) => pkg.memberId === memberId);
  const trainerFirst = user.name.split(" ")[0];
  // Real accounts a placeholder can be merged into.
  const realMembers = members.filter((member) => !member.placeholder).map(({ id, name, phone }) => ({ id, name, phone }));

  return <AppShell className="members-screen">
    <section>
      <h1>Üyeler</h1>
      {merged && <Notice tone="success">{merged}</Notice>}
      <MemberFilter total={members.length}/>
      <AddPlaceholderForm/>
      {members.length ? <div className="member-list">{members.map((member) => <article key={member.id} data-member-search={`${member.name} ${member.placeholder ? "hesapsız" : member.email} ${member.phone ?? ""}`.toLocaleLowerCase("tr").normalize("NFD").replace(/\p{M}/gu, "")}>
        <Avatar name={member.name} src={member.avatarUrl} size={52}/>
        <div className="member-main">
          <strong>{member.name}</strong>
          {member.placeholder
            ? <span>Uygulamada hesabı yok · derslerini sen yönetiyorsun</span>
            : <span>{member.phone && <a href={`tel:${member.phone}`}>{formatPhone(member.phone)}</a>}<a href={`mailto:${member.email}`}>{member.email}</a></span>}
          <span className="member-stats">
            <span>{member.completed} ders</span>
            {member.upcoming > 0 && <span>{member.upcoming} yaklaşan</span>}
            {member.noShows > 0 && <span className="is-warning">{member.noShows} gelmedi</span>}
            {member.averageEffort !== null && <span>Efor {member.averageEffort}/10</span>}
            <span>{member.lastLesson ? `Son ders ${formatDayMonth(member.lastLesson)}` : `Üye ${formatDayMonth(member.joinedAt)}`}</span>
          </span>
          <span className="member-package">{member.placeholder && <StatusBadge tone="neutral" dot>Hesapsız</StatusBadge>}{member.invited && <StatusBadge tone="blue" dot>Davet bekliyor</StatusBadge>}<PackageBadge state={packageState(packagesOf(member.id), today)}/></span>
          <PackageEditor memberId={member.id} memberName={member.name} packages={packagesOf(member.id)} today={today}/>
          {member.placeholder && <MergeMemberForm placeholderId={member.id} placeholderName={member.name} members={realMembers}/>}
        </div>
        <WhatsAppLink href={whatsappLink(member.phone, `Merhaba ${member.name.split(" ")[0]},\n\n${trainerFirst} · Flowly Pilates`)}>WhatsApp</WhatsAppLink>
      </article>)}</div> : <EmptyState icon="users" title="Henüz üye yok." text="Üyeler uygulamaya kayıt oldukça burada listelenecek."/>}
    </section>
  </AppShell>;
}
