import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { ReviewStatusBadge } from "@/components/status";
import { UploadForm } from "@/components/upload-form";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { DOCUMENT_CATEGORIES } from "@/lib/engine/fields";
import { listApplicationsForUser } from "@/lib/services/applications";
import { listDocumentsForUser, uploadLimits } from "@/lib/services/documents";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Documents" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ application?: string; requirement?: string; category?: string; deleted?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [docs, limits, apps] = await Promise.all([listDocumentsForUser(user.id), uploadLimits(), listApplicationsForUser(user.id)]);
  const openApps = apps.filter((a) => !["submitted", "shortlisted", "outcome"].includes(a.app.status)).map((a) => ({ id: a.app.id, name: a.sch.name }));
  return (
    <>
      <PageHeader title="Documents" description="Your private document workspace. Every upload creates a new version — nothing is ever silently overwritten." />
      {sp.deleted && <Alert tone="success" className="mb-6">Document removed from your workspace.</Alert>}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card className="lg:self-start">
          <CardHeader><CardTitle>Upload a document</CardTitle></CardHeader>
          <CardBody>
            <UploadForm allowed={limits.allowed} maxMb={limits.maxMb} applicationId={sp.application} requirementId={sp.requirement} category={sp.category} applications={openApps} />
          </CardBody>
        </Card>
        <div>
          {docs.length === 0 ? (
            <EmptyState icon={FolderOpen} title="No documents yet" description="Upload your transcript, CV, passport and other documents. Reviewers can then give you feedback." />
          ) : (
            <Table caption="Your documents">
              <thead><tr><Th>Document</Th><Th>Type</Th><Th>Status</Th><Th>Updated</Th></tr></thead>
              <tbody>
                {docs.map(({ d, scholarshipName }) => (
                  <tr key={d.id}>
                    <Td><Link href={`/documents/${d.id}`} className="font-semibold hover:underline">{d.title}</Link><span className="block text-xs text-muted">v{d.currentVersion}{scholarshipName ? ` · ${scholarshipName}` : " · Library"}</span></Td>
                    <Td>{DOCUMENT_CATEGORIES.find((c) => c.value === d.category)?.label}</Td>
                    <Td><ReviewStatusBadge status={d.reviewStatus} /></Td>
                    <Td className="whitespace-nowrap text-muted">{formatDateTime(d.updatedAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </>
  );
}
