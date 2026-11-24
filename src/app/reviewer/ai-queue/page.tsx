import Link from "next/link";
import { Bot } from "lucide-react";
import { Badge, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { aiQueue } from "@/lib/services/essays";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "AI approval queue" };
export const dynamic = "force-dynamic";

export default async function AiQueuePage() {
  const user = await requireUser();
  const rows = await aiQueue(user);
  return (
    <>
      <PageHeader title="AI approval queue" description="Every AI-generated critique stays unpublished until an authorised reviewer approves it. Edit freely — you are the author of record." />
      {rows.length === 0 ? <EmptyState icon={Bot} title="No critiques awaiting approval" /> : (
        <Table caption="AI critiques awaiting approval">
          <thead><tr><Th>Applicant</Th><Th>Essay</Th><Th>Scholarship</Th><Th>Generated</Th><Th>Model</Th><Th>Status</Th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.approval_id}>
                <Td>{r.first_name} {r.last_name}</Td>
                <Td><Link href={`/reviewer/essays/${r.essay_id}#ai`} className="font-semibold hover:underline">{r.essay_title}</Link><span className="block text-xs text-muted">v{r.version_number}</span></Td>
                <Td>{r.scholarship_name ?? "—"}</Td>
                <Td className="whitespace-nowrap">{formatDateTime(r.generated_at)}</Td>
                <Td className="text-xs">{r.provider} · {r.model}</Td>
                <Td><Badge tone={r.decision === "pending" ? "warning" : "info"}>{r.decision === "pending" ? "Awaiting approval" : "Needs more review"}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
