"use client";

import {
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  CalendarClock,
  ClipboardCheck,
  FileCheck2,
  FileText,
  FolderOpen,
  GraduationCap,
  History,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  Menu,
  NotebookPen,
  Scale,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCircle,
  UserRoundCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn, initials } from "@/lib/utils";
import { Logo } from "./logo";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  scholarships: GraduationCap,
  applications: ClipboardCheck,
  planner: CalendarClock,
  documents: FolderOpen,
  essays: NotebookPen,
  referees: UserRoundCheck,
  learn: BookOpen,
  notifications: Bell,
  profile: UserCircle,
  settings: Settings,
  users: Users,
  rules: Scale,
  docreview: FileCheck2,
  essayreview: FileText,
  ai: Bot,
  content: BookOpen,
  analytics: BarChart3,
  roles: ShieldCheck,
  audit: History,
  list: ListChecks,
  mail: Mail,
  sparkles: Sparkles,
};

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: number;
  exact?: boolean;
}
export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export function PortalShell({
  groups,
  user,
  areaLabel,
  switcher,
  unread,
  logout,
  children,
  homeHref,
}: {
  groups: NavGroup[];
  user: { firstName: string; lastName: string; email: string };
  areaLabel: string;
  switcher?: { href: string; label: string }[];
  unread: number;
  logout: () => Promise<void>;
  children: React.ReactNode;
  homeHref: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/"));

  const nav = (
    <nav aria-label={`${areaLabel} navigation`} className="space-y-6">
      {groups.map((g, i) => (
        <div key={i}>
          {g.label && <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ivory/70">{g.label}</p>}
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const Icon = ICONS[item.icon] ?? LayoutDashboard;
              const active = isActive(item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors",
                      active ? "bg-white/10 text-ivory shadow-[inset_3px_0_0_var(--color-gold-500)]" : "text-ivory/75 hover:bg-white/5 hover:text-ivory",
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                    {!!item.badge && <span className="ml-auto rounded-full bg-gold-500 px-2 py-0.5 text-[11px] font-bold text-navy-950">{item.badge > 99 ? "99+" : item.badge}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden bg-navy-900 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="px-5 py-5">
          <Logo href={homeHref} light />
          <p className="mt-2 text-xs font-medium text-gold-400">{areaLabel}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">{nav}</div>
        {switcher && switcher.length > 0 && (
          <div className="border-t border-white/10 px-3 py-3">
            {switcher.map((s) => (
              <Link key={s.href} href={s.href} className="block rounded-lg px-3 py-2 text-[13px] font-medium text-ivory/70 hover:bg-white/5 hover:text-ivory">
                {s.label} →
              </Link>
            ))}
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-ivory/90 px-4 backdrop-blur sm:px-6">
          <button type="button" className="inline-flex size-11 items-center justify-center rounded-lg text-navy-900 hover:bg-ivory-200 lg:hidden" aria-expanded={open} aria-controls="portal-mobile-nav" onClick={() => setOpen(true)}>
            <Menu aria-hidden />
            <span className="sr-only">Open navigation</span>
          </button>
          <div className="lg:hidden">
            <Logo href={homeHref} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/notifications" className="relative inline-flex size-11 items-center justify-center rounded-lg text-navy-900 hover:bg-ivory-200" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}>
              <Bell className="size-5" aria-hidden />
              {unread > 0 && <span className="absolute right-1.5 top-1.5 min-w-5 rounded-full bg-gold-500 px-1 text-center text-[11px] font-bold leading-5 text-navy-950">{unread > 9 ? "9+" : unread}</span>}
            </Link>
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ivory-200 [&::-webkit-details-marker]:hidden">
                <span className="flex size-9 items-center justify-center rounded-full bg-navy-900 text-sm font-semibold text-ivory" aria-hidden>
                  {initials(user.firstName, user.lastName)}
                </span>
                <span className="hidden text-sm font-semibold sm:block">{user.firstName}</span>
                <span className="sr-only">Account menu</span>
              </summary>
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-line bg-white p-2 shadow-lg">
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="truncate text-xs text-muted">{user.email}</p>
                </div>
                <Link href="/profile" className="block rounded-lg px-3 py-2 text-sm hover:bg-ivory-200">
                  Profile
                </Link>
                <Link href="/settings" className="block rounded-lg px-3 py-2 text-sm hover:bg-ivory-200">
                  Settings & privacy
                </Link>
                {switcher?.map((s) => (
                  <Link key={s.href} href={s.href} className="block rounded-lg px-3 py-2 text-sm hover:bg-ivory-200">
                    {s.label}
                  </Link>
                ))}
                <form action={logout}>
                  <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-danger-700 hover:bg-danger-100">
                    <LogOut className="size-4" aria-hidden /> Sign out
                  </button>
                </form>
              </div>
            </details>
          </div>
        </header>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <button type="button" className="absolute inset-0 bg-navy-950/50" aria-label="Close navigation" onClick={() => setOpen(false)} />
            <div id="portal-mobile-nav" className="absolute inset-y-0 left-0 flex w-[min(300px,85vw)] flex-col bg-navy-900 shadow-xl">
              <div className="flex items-center justify-between px-4 py-4">
                <Logo href={homeHref} light />
                <button type="button" className="inline-flex size-11 items-center justify-center rounded-lg text-ivory hover:bg-white/10" onClick={() => setOpen(false)}>
                  <X aria-hidden />
                  <span className="sr-only">Close navigation</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-6">{nav}</div>
            </div>
          </div>
        )}

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
