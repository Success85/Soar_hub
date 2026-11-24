import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { ReviewStatusBadge } from "@/components/status";
import { EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { DOCUMENT_CATEGORIES } from "@/lib/engine/fields";
import { documentReviewQueue } from "@/lib/services/documents";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Document reviews" };
export const dynamic = "force-dynamic";

export default async function DocQueuePage() {
  const user = await requireUser();
  const rows = await documentReviewQueue(user);
  return (
    <>
      <PageHeader title="Document review queue" description={user.permissions.has("reviews.documents") ? "All documents awaiting review." : "Documents from applicants assigned to you."} />
      {rows.length === 0 ? <EmptyState icon={FileCheck2} title="Nothing waiting" description="New review requests will appear here." /> : (
        <Table caption="Documents awaiting review">
          <thead><tr><Th>Applicant</Th><Th>Scholarship</Th><Th>Document</Th><Th>Version</Th><Th>Uploaded</Th><Th>Status</Th><Th>Reviewer</Th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td>{r.first_name} {r.last_name}</Td>
                <Td>{r.scholarship_name ?? "—"}</Td>
                <Td><Link href={`/reviewer/documents/${r.id}`} className="font-semibold hover:underline">{r.title}</Link><span className="block text-xs text-muted">{DOCUMENT_CATEGORIES.find((c) => c.value === r.category)?.label}</span></Td>
                <Td>v{r.current_version}</Td>
                <Td className="whitespace-nowrap">{formatDateTime(r.updated_at)}</Td>
                <Td><ReviewStatusBadge status={r.review_status as never} /></Td>
                <Td className="text-muted">{r.reviewer_names ?? "Unassigned"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
