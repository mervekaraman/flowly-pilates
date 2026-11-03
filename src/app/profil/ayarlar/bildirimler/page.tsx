import { EmailNotificationsSwitch } from "@/components/flowly/forms";
import { NativePushSettings } from "@/components/flowly/native";
import { PushSettings } from "@/components/flowly/push";
import { AppShell } from "@/components/flowly/shell";
import { TopBar } from "@/components/flowly/ui";
import { requireUser } from "@/lib/dal";
import { pushPublicKey } from "@/lib/push";
import { isNativeApp } from "@/lib/request";

export const metadata = { title: "Bildirim ayarları" };

export default async function NotificationSettingsPage() {
  const user = await requireUser({ next: "/profil/ayarlar/bildirimler" });
  // Web Push only exists for home-screen web apps in Safari, not inside the iOS app.
  const inApp = await isNativeApp();
  const publicKey = inApp ? null : pushPublicKey();
  return <AppShell className="settings-screen" nav={false}>
    <TopBar back="/profil/ayarlar" title="Bildirimler"/>
    <section>
      <h2>E-posta</h2>
      <EmailNotificationsSwitch enabled={user.emailNotifications}/>
      {(inApp || publicKey) && <h2>Telefon</h2>}
      {inApp ? <NativePushSettings/> : publicKey && <PushSettings publicKey={publicKey}/>}
    </section>
  </AppShell>;
}
