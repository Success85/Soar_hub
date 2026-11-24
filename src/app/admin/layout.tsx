import type { Metadata } from "next";
import { PortalShell } from "@/components/layout/portal-shell";
import { requirePermissionPage } from "@/lib/auth/session";
import { adminNav } from "@/lib/admin-nav";
import { logoutAction, switcherFor, unreadCount } from "@/lib/portal";
import { overviewStats } from "@/lib/services/admin";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · SOAR Hub" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePermissionPage("admin.access", "/admin");
  const [unread, s] = await Promise.all([unreadCount(user.id), overviewStats()]);
  const badges = {
    "/admin/document-reviews": s.pending_document_reviews,
    "/admin/essay-reviews": s.pending_essay_reviews,
    "/admin/ai-queue": s.pending_ai_approvals,
    "/admin/notifications": s.failed_notifications,
    "/admin/data-requests": s.pending_data_requests,
    "/admin/scholarships": s.scholarships_pending_verification,
  };
  return (
    <PortalShell groups={adminNav(user.permissions, badges)} user={user} areaLabel="Admin dashboard" switcher={switcherFor(user, "admin")} unread={unread} logout={logoutAction} homeHref="/admin">
      {children}
    </PortalShell>
  );
}
