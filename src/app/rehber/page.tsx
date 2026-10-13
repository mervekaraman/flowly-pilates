import { AppShell } from "@/components/flowly/shell";
import { Tutorial } from "@/components/flowly/tutorial";
import { Brand, PageHeading, TopBar } from "@/components/flowly/ui";
import { homeFor, requireUser } from "@/lib/dal";
import { safeNext } from "@/lib/privacy";
import { tutorialSteps } from "@/lib/tutorial";

export const metadata = { title: "Nasıl kullanılır?" };

export default async function GuidePage({ searchParams }: PageProps<"/rehber">) {
  const user = await requireUser({ next: "/rehber" });
  const params = await searchParams;
  // ?ilk=1 right after sign-up: a focused welcome without menus; afterwards the guide stays here.
  const first = params.ilk === "1";
  const next = safeNext(typeof params.sonra === "string" ? params.sonra : null);
  const trainer = user.role === "trainer";
  const name = user.name.trim().split(/\s+/)[0];

  return <AppShell className={`tutorial-screen${first ? " is-first" : ""}`} bare={first}>
    {first ? <header className="tutorial-brand"><Brand/></header> : <TopBar back="/profil"/>}
    <section>
      <PageHeading
        eyebrow={first ? "Hoş geldin" : trainer ? "Eğitmen rehberi" : "Rehber"}
        title={first ? `Merhaba ${name}!` : "Nasıl kullanılır?"}
        sub={trainer ? "Ders açmaktan yoklamaya, paneli birkaç adımda tanı." : "Ders seçmekten iptale, uygulamayı birkaç adımda tanı."}/>
      <Tutorial steps={tutorialSteps(user.role)} finishHref={next ?? homeFor(user)}
        finishLabel={first ? (trainer ? "Panele Geç" : "Ders Seç") : "Tamam"}
        skipLabel={first ? "Şimdilik geç" : "Kapat"}/>
      {first && <p className="tutorial-later">Bu rehbere daha sonra Profil › Nasıl kullanılır? bölümünden ulaşabilirsin.</p>}
    </section>
  </AppShell>;
}
