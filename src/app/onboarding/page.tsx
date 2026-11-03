import Link from "next/link";
import { LightStatusBar } from "@/components/flowly/native";
import { Brand, ButtonLink } from "@/components/flowly/ui";
import { studio } from "@/lib/studio";

export const metadata = { title: "Başla" };

export default function OnboardingPage() {
  return <main className="flowly-app onboarding-screen"><div className="flowly-phone">
    <LightStatusBar/>
    <div className="onboarding-photo"/>
    <div className="onboarding-brand"><Brand light/><p>{studio.name}</p></div>
    <div className="onboarding-copy">
      <h1>Bedeninle tekrar<br/>bağlantı kur.</h1>
      <p>{studio.name}&apos;te reformer dersini seç,<br/>yerini birkaç dokunuşla ayır.</p>
      <ButtonLink href="/uye-ol" variant="outline">Başla</ButtonLink>
      <Link href="/giris">Zaten hesabım var</Link>
    </div>
  </div></main>;
}
