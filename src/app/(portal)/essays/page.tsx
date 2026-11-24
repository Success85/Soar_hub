import type { Metadata } from "next";
import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { EssayStatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { listEssaysForUser } from "@/lib/services/essays";
import { formatDateTime } from "@/lib/utils";
import { EssayTabs } from "@/components/essay-tabs";

export const metadata: Metadata = { title: "Essays" };

export default async function EssaysPage() {
  const user = await requireUser();
  const essays = await listEssaysForUser(user.id);
  return (
    <>
      <PageHeader title="Essays & answer bank" description="Draft in your own voice, keep every version, and get feedback from reviewers. AI suggestions are always checked by a person first." actions={<Button asChild><Link href="/essays/new">New essay</Link></Button>} />
      <EssayTabs current="essays" />
      {essays.length === 0 ? (
        <EmptyState icon={NotebookPen} title="No essays yet" description="Create your first essay. Paste the scholarship's prompt, then write — we'll count words and save every version." action={<Button asChild><Link href="/essays/new">Start writing</Link></Button>} />
      ) : (
        <Table caption="Your essays">
          <thead><tr><Th>Essay</Th><Th>Scholarship</Th><Th>Words</Th><Th>Status</Th><Th>Updated</Th></tr></thead>
          <tbody>
            {essays.map(({ e, scholarshipName }) => (
              <tr key={e.id}>
                <Td><Link href={`/essays/${e.id}`} className="font-semibold hover:underline">{e.title}</Link><span className="block text-xs text-muted">v{e.currentVersion}</span></Td>
                <Td>{scholarshipName ?? <span className="text-muted">—</span>}</Td>
                <Td className={e.wordLimit && e.wordCount > e.wordLimit ? "font-semibold text-danger-700" : ""}>{e.wordCount}{e.wordLimit ? ` / ${e.wordLimit}` : ""}</Td>
                <Td><EssayStatusBadge status={e.status} /></Td>
                <Td className="whitespace-nowrap text-muted">{formatDateTime(e.updatedAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
