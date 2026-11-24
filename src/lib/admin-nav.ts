import type { NavGroup } from "@/components/layout/portal-shell";
import type { Permission } from "@/lib/auth/permissions";

type Item = NavGroup["items"][number] & { perm: Permission };

const GROUPS: { label?: string; items: Item[] }[] = [
  { items: [{ href: "/admin", label: "Overview", icon: "dashboard", exact: true, perm: "admin.access" }] },
  {
    label: "Operations",
    items: [
      { href: "/admin/applicants", label: "Applicants", icon: "users", perm: "applicants.view" },
      { href: "/admin/applications", label: "Applications", icon: "applications", perm: "applicants.view" },
      { href: "/admin/scholarships", label: "Scholarships", icon: "scholarships", perm: "scholarships.manage" },
      { href: "/admin/eligibility-rules", label: "Eligibility rules", icon: "rules", perm: "scholarships.manage" },
      { href: "/admin/referees", label: "Referees", icon: "referees", perm: "referees.manage" },
    ],
  },
  {
    label: "Reviews",
    items: [
      { href: "/admin/document-reviews", label: "Document reviews", icon: "docreview", perm: "reviews.documents" },
      { href: "/admin/essay-reviews", label: "Essay reviews", icon: "essayreview", perm: "reviews.essays" },
      { href: "/admin/ai-queue", label: "AI approval queue", icon: "ai", perm: "ai.approve" },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/admin/notifications", label: "Notifications", icon: "mail", perm: "notifications.manage" },
      { href: "/admin/content", label: "Content & resources", icon: "content", perm: "content.manage" },
      { href: "/admin/analytics", label: "Analytics & reports", icon: "analytics", perm: "analytics.view" },
      { href: "/admin/users", label: "Users & roles", icon: "roles", perm: "users.manage" },
      { href: "/admin/data-requests", label: "Privacy requests", icon: "list", perm: "data_requests.manage" },
      { href: "/admin/audit", label: "Audit logs", icon: "audit", perm: "audit.view" },
      { href: "/admin/settings", label: "Settings", icon: "settings", perm: "settings.manage" },
    ],
  },
];

export function adminNav(perms: Set<string>, badges: Record<string, number> = {}): NavGroup[] {
  return GROUPS.map((g) => ({ label: g.label, items: g.items.filter((i) => perms.has(i.perm)).map(({ perm: _p, ...i }) => (void _p, { ...i, badge: badges[i.href] })) })).filter((g) => g.items.length);
}
