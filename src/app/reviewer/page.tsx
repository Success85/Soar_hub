import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { AppStatusBadge } from "@/components/status";
import { EmptyState, PageHeader, Progress, Stat } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { assignedApplications } from "@/lib/services/admin";
import { documentReviewQueue } from "@/lib/services/documents";
import { aiQueue, essayReviewQueue } from "@/lib/services/essays";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReviewerHome() {
  const user = await requireUser();
  const [apps, docs, essays, ai] = await Promise.all([assignedApplications(user.id), documentReviewQueue(user), essayReviewQueue(user), aiQueue(user)]);
  return (
    <>
      <PageHeader title={`Welcome, ${user.firstName}`} description="The applicants assigned to you and the work waiting for your review." />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Assigned applicants" value={apps.length} />
        <Stat label="Documents to review" value={docs.length} href="/reviewer/documents" tone={docs.length ? "warning" : "default"} />
        <Stat label="Essays to review" value={essays.length} href="/reviewer/essays" tone={essays.length ? "warning" : "default"} />
        <Stat label="AI critiques to approve" value={ai.length} href="/reviewer/ai-queue" tone={ai.length ? "warning" : "default"} />
      </div>
      <h2 className="mb-3 text-lg font-semibold">Assigned applications</h2>
      {apps.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No applicants assigned yet" description="An administrator will assign applicants to you. You'll get an email and in-app notification." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {apps.map(({ a, s, u }) => (
            <li key={a.id} className="rounded-[var(--radius-card)] border border-line bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><Link href={`/reviewer/applications/${a.id}`} className="font-semibold hover:underline">{u.firstName} {u.lastName}</Link><p className="text-sm text-muted">{s.name}</p></div>
                <AppStatusBadge status={a.status} outcome={a.outcome} />
              </div>
              <div className="mt-3 flex items-center gap-3"><Progress value={a.progress} label="Progress" /><span className="text-sm font-semibold">{a.progress}%</span></div>
              <p className="mt-2 text-xs text-muted">Deadline {formatDate(s.deadline)}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
