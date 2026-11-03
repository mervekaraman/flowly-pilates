import { getCurrentUser } from "@/lib/dal";
import { unreadCount } from "@/lib/queries";
import { NativePushSync } from "./native";
import { BottomNav, SiteHeader, type NavVariant } from "./nav";

/**
 * Page frame: shared top header on desktop, bottom navigation on phones.
 * Reading the session here also makes every page request-time rendered, which the database needs.
 */
export async function AppShell({ className = "", children, nav = true, bare = false }: { className?: string; children: React.ReactNode; nav?: boolean; bare?: boolean }) {
  const user = await getCurrentUser();
  const variant: NavVariant = user?.role ?? "public";
  const unread = user ? await unreadCount(user.id) : 0;
  return <main className={`flowly-app ${className}`}>
    {!bare && <SiteHeader variant={variant} user={user ? { name: user.name, avatarUrl: user.avatarUrl } : null} unread={unread}/>}
    <div className="flowly-phone">{children}{nav && !bare && <BottomNav variant={variant} unread={unread}/>}</div>
    <NativePushSync signedIn={Boolean(user)}/>
  </main>;
}
