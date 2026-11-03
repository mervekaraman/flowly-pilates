import Link from "next/link";
import { LightStatusBar } from "@/components/flowly/native";
import { Brand } from "@/components/flowly/ui";

export const metadata = { title: "Hoş geldin" };

export default function SplashPage() {
  return <main className="flowly-app splash-screen"><div className="flowly-phone">
    <LightStatusBar/>
    <Link href="/onboarding" className="splash-link" aria-label="Başla">
      <div className="splash-photo"/>
      <div className="splash-logo"><Brand light/><p lang="en">PILATES.<br/>NEARBY.<br/>ON YOUR TERMS.</p></div>
    </Link>
  </div></main>;
}
