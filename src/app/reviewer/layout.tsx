import type { Metadata } from "next";
import { PortalShell } from "@/components/layout/portal-shell";
import { requirePermissionPage } from "@/lib/auth/session";
import { logoutAction, switcherFor, unreadCount } from "@/lib/portal";
import { REVIEWER_NAV } from "@/lib/reviewer-nav";

export const metadata: Metadata = { title: { default: "Reviewer workspace", template: "%s · Reviewer · SOAR Hub" }, robots: { index: false } };

export default async function ReviewerLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePermissionPage("reviewer.access", "/reviewer");
  const unread = await unreadCount(user.id);
  return (
    <PortalShell groups={REVIEWER_NAV} user={user} areaLabel="Reviewer workspace" switcher={switcherFor(user, "reviewer")} unread={unread} logout={logoutAction} homeHref="/reviewer">
      {children}
    </PortalShell>
  );
}
