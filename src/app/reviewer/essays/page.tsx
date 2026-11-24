import Link from "next/link";
import { FileText } from "lucide-react";
import { EssayStatusBadge } from "@/components/status";
import { Badge, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { essayReviewQueue } from "@/lib/services/essays";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Essay reviews" };
export const dynamic = "force-dynamic";

export default async function EssayQueuePage() {
  const user = await requireUser();
  const rows = await essayReviewQueue(user);
  return (
    <>
      <PageHeader title="Essay review queue" description="Essays waiting for human review. AI critiques must be approved in the AI approval queue before they reach applicants." />
      {rows.length === 0 ? <EmptyState icon={FileText} title="No essays waiting" /> : (
        <Table caption="Essays awaiting review">
          <thead><tr><Th>Applicant</Th><Th>Scholarship</Th><Th>Essay & prompt</Th><Th>Submitted</Th><Th>Status</Th><Th>AI</Th><Th>Reviewer</Th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.essay_id}>
                <Td>{r.first_name} {r.last_name}</Td>
                <Td>{r.scholarship_name ?? "—"}</Td>
                <Td><Link href={`/reviewer/essays/${r.essay_id}`} className="font-semibold hover:underline">{r.title}</Link><span className="block max-w-xs truncate text-xs text-muted">{r.prompt}</span></Td>
                <Td className="whitespace-nowrap">{formatDateTime(r.submitted_at)}</Td>
                <Td><EssayStatusBadge status={r.status as never} /></Td>
                <Td>{r.ai_status ? <Badge tone={r.ai_status === "failed" ? "danger" : r.ai_status === "completed" ? "success" : "info"}>{r.ai_status}</Badge> : <span className="text-muted">—</span>}</Td>
                <Td className="text-muted">{r.reviewer_names ?? "Unassigned"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
