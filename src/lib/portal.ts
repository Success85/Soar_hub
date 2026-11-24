import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { logoutAction } from "@/app/actions/auth";
import type { NavGroup } from "@/components/layout/portal-shell";
import type { CurrentUser } from "@/lib/auth/session";
import { hasPerm } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";

export async function unreadCount(userId: string) {
  const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.channel, "in_app"), isNull(notifications.readAt)));
  return r?.c ?? 0;
}

export function switcherFor(user: CurrentUser, current: "applicant" | "reviewer" | "admin") {
  const out: { href: string; label: string }[] = [];
  if (current !== "admin" && hasPerm(user, "admin.access")) out.push({ href: "/admin", label: "Admin dashboard" });
  if (current !== "reviewer" && hasPerm(user, "reviewer.access")) out.push({ href: "/reviewer", label: "Reviewer workspace" });
  if (current !== "applicant" && user.roles.includes("applicant")) out.push({ href: "/dashboard", label: "Applicant portal" });
  return out;
}

export const APPLICANT_NAV: NavGroup[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/scholarships", label: "Scholarships", icon: "scholarships" },
      { href: "/applications", label: "My applications", icon: "applications" },
      { href: "/planner", label: "Application planner", icon: "planner" },
    ],
  },
  {
    label: "Prepare",
    items: [
      { href: "/documents", label: "Documents", icon: "documents" },
      { href: "/essays", label: "Essays & answer bank", icon: "essays" },
      { href: "/referees", label: "Referees", icon: "referees" },
      { href: "/learn", label: "Learning resources", icon: "learn" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/notifications", label: "Notifications", icon: "notifications" },
      { href: "/profile", label: "Profile", icon: "profile" },
      { href: "/settings", label: "Settings", icon: "settings" },
    ],
  },
];

export { logoutAction };
