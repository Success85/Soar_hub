import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { AppStatusBadge } from "@/components/status";
import { DeadlineBadge } from "@/components/scholarship-card";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Progress } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { listApplicationsForUser } from "@/lib/services/applications";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "My applications" };

export default async function ApplicationsPage() {
  const user = await requireUser();
  const apps = await listApplicationsForUser(user.id);
  return (
    <>
      <PageHeader title="My applications" description="Track each application from screening to outcome." actions={<Button asChild><Link href="/scholarships">Start a new application</Link></Button>} />
      {apps.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="You haven't started an application yet" description="Find a scholarship, check your eligibility, then start an application to get a personal plan." action={<Button asChild><Link href="/scholarships">Explore scholarships</Link></Button>} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {apps.map(({ app, sch }) => (
            <li key={app.id} className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link href={`/applications/${app.id}`} className="text-lg font-semibold leading-snug hover:underline">{sch.name}</Link>
                <AppStatusBadge status={app.status} outcome={app.outcome} />
              </div>
              <p className="mt-1 text-sm text-muted">{sch.partnerUniversity}</p>
              <div className="mt-4 flex items-center gap-3"><Progress value={app.progress} label="Progress" /><span className="text-sm font-semibold">{app.progress}%</span></div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">Deadline {formatDate(sch.deadline)} <DeadlineBadge deadline={sch.deadline} /></div>
              {!sch.isActive && <p className="mt-2 text-xs text-warning-700">This scholarship has been deactivated. Your records are preserved.</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
