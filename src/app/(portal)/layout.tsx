import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PortalShell, type NavGroup } from "@/components/layout/portal-shell";
import { requireUser } from "@/lib/auth/session";
import { APPLICANT_NAV, logoutAction, switcherFor, unreadCount } from "@/lib/portal";

const SHARED = ["/notifications", "/profile", "/settings"];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-pathname") ?? "";
  // Account settings stay reachable without a membership (privacy rights, password, deletion).
  const user = await requireUser({ allowUnpaid: path.startsWith("/settings"), next: path || undefined });
  const unread = await unreadCount(user.id);
  const isApplicant = user.roles.includes("applicant");
  if (!isApplicant) {
    if (!SHARED.some((p) => path.startsWith(p))) redirect(user.permissions.has("admin.access") ? "/admin" : "/reviewer");
    const staffNav: NavGroup[] = [
      { items: [{ href: user.permissions.has("admin.access") ? "/admin" : "/reviewer", label: "Back to workspace", icon: "dashboard" }] },
      { label: "Account", items: [{ href: "/notifications", label: "Notifications", icon: "notifications", badge: unread }, { href: "/profile", label: "Profile", icon: "profile" }, { href: "/settings", label: "Settings", icon: "settings" }] },
    ];
    return (
      <PortalShell groups={staffNav} user={user} areaLabel="Account" switcher={switcherFor(user, "applicant")} unread={unread} logout={logoutAction} homeHref="/">
        {children}
      </PortalShell>
    );
  }
  const groups = APPLICANT_NAV.map((g) => ({ ...g, items: g.items.map((i) => (i.href === "/notifications" ? { ...i, badge: unread } : i)) }));
  return (
    <PortalShell groups={groups} user={user} areaLabel="Applicant portal" switcher={switcherFor(user, "applicant")} unread={unread} logout={logoutAction} homeHref="/dashboard">
      {children}
    </PortalShell>
  );
}
