import { headers } from "next/headers";
import { isOldAppBuild } from "@/lib/canonical-host";
import { studio } from "@/lib/studio";

/**
 * Shown only inside an iOS app build that still opens the old vercel.app address, and only once the
 * fixed version is on the App Store (OLD_APP_BANNER=on): those builds cannot connect on mobile data.
 */
export async function OldAppBanner() {
  if (process.env.OLD_APP_BANNER !== "on") return null;
  const list = await headers();
  if (!isOldAppBuild(list.get("host"), list.get("user-agent"))) return null;
  return <div className="old-app-banner" role="status">
    <span>Mobil veride de çalışan yeni sürüm hazır.</span>
    <a href={studio.appStoreUrl}>Güncelle</a>
  </div>;
}
