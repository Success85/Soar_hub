import type { NavGroup } from "@/components/layout/portal-shell";

export const REVIEWER_NAV: NavGroup[] = [
  {
    items: [
      { href: "/reviewer", label: "My assignments", icon: "dashboard", exact: true },
      { href: "/reviewer/documents", label: "Document reviews", icon: "docreview" },
      { href: "/reviewer/essays", label: "Essay reviews", icon: "essayreview" },
      { href: "/reviewer/ai-queue", label: "AI approval queue", icon: "ai" },
    ],
  },
  { label: "Account", items: [{ href: "/notifications", label: "Notifications", icon: "notifications" }, { href: "/profile", label: "Profile", icon: "profile" }, { href: "/settings", label: "Settings", icon: "settings" }] },
];
