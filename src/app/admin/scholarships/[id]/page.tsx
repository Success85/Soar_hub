import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import {
  addSourceAction,
  duplicateScholarshipAction,
  saveRequirementsAction,
  saveRubricAction,
  scholarshipStatusAction,
  sourceAction,
  uploadScholarshipFileAction,
} from "@/app/actions/admin";
import { MilestoneEditor } from "@/components/admin/milestone-editor";
import { CriteriaBuilder, type CriterionDraft } from "@/components/admin/criteria-builder";
import { ScholarshipForm } from "@/components/admin/scholarship-form";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ScholarshipStatusBadge } from "@/components/status";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { Alert, Badge, PageHeader } from "@/components/ui/misc";
import { requirePermissionPage } from "@/lib/auth/session";
import { OPERATORS } from "@/lib/engine/eligibility";
import { DOCUMENT_CATEGORIES, FIELDS } from "@/lib/engine/fields";
import { DEFAULT_RUBRIC } from "@/lib/integrations/ai";
import { templatesFor } from "@/lib/services/planner";
import { getScholarshipBundle, publicationProblems, revisions } from "@/lib/services/scholarships";
import { cn, fileSize, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Scholarship" };
export const dynamic = "force-dynamic";

const TABS = [
  ["details", "Details"],
  ["sources", "Sources & verification"],
  ["criteria", "Eligibility criteria"],
  ["documents", "Required documents"],
  ["milestones", "Milestone template"],
  ["rubric", "Essay rubric"],
  ["files", "Supporting files"],
  ["history", "History"],
] as const;

function toDraft(c: Awaited<ReturnType<typeof getScholarshipBundle>> extends infer B ? (B extends { criteria: (infer C)[] } ? C : never) : never): CriterionDraft {
  const v = c.requiredValue;
  return {
    id: c.id,
    name: c.name,
    description: c.description ?? "",
    fieldKey: c.fieldKey,
    operator: c.operator,
    value: Array.isArray(v) && !["between", "age_between"].includes(c.operator) ? v.join(", ") : v === null || v === undefined || Array.isArray(v) ? "" : String(v),
    min: Array.isArray(v) && ["between", "age_between"].includes(c.operator) ? String(v[0] ?? "") : "",
    max: Array.isArray(v) && ["between", "age_between"].includes(c.operator) ? String(v[1] ?? "") : "",
    severity: c.severity,
    isFixable: c.isFixable,
    isRequired: c.isRequired,
    passExplanation: c.passExplanation ?? "",
    failExplanation: c.failExplanation ?? "",
    recommendedAction: c.recommendedAction ?? "",
    sourceReference: c.sourceReference ?? "",
    questionText: c.questionText ?? "",
    answerType: c.answerType ?? "boolean",
    answerOptions: Array.isArray(c.answerOptions) ? (c.answerOptions as string[]).join(", ") : "",
    groupKey: c.groupId ?? "",
  };
}

export default async function AdminScholarship({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; created?: string }> }) {
  const user = await requirePermissionPage("scholarships.manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const b = await getScholarshipBundle({ id });
  if (!b) notFound();
  const sp = await searchParams;
  const tab = TABS.find(([k]) => k === sp.tab)?.[0] ?? "details";
  const s = b.scholarship;
  const problems = await publicationProblems(id);
  const canPublish = user.permissions.has("scholarships.publish");
  const status = (action: string, label: string, variant: "primary" | "secondary" | "ghost" | "danger" = "secondary", confirm?: string) => <ActionButton action={scholarshipStatusAction} fields={{ id, action }} variant={variant} confirm={confirm}>{label}</ActionButton>;

  return (
    <>
      <PageHeader back={{ href: "/admin/scholarships", label: "Scholarships" }} title={s.name} description={`${s.partnerUniversity} · updated ${formatDateTime(s.updatedAt)}`} actions={<><ScholarshipStatusBadge status={s.status} />{s.isDemo && <Badge>Demo record</Badge>}</>} />
      {sp.created && <Alert tone="success" className="mb-4">Draft created. Next: add and verify the official source, then criteria and required documents.</Alert>}

      <Card className="mb-6">
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {["draft", "deactivated"].includes(s.status) && status("submit_for_verification", "Submit for verification")}
            {canPublish && ["draft", "pending_verification", "verified", "published"].includes(s.status) && status("verify", s.lastVerifiedAt ? "Re-verify source now" : "Mark source verified")}
            {canPublish && s.status !== "published" && !["archived"].includes(s.status) && status("publish", "Publish", "primary")}
            {canPublish && s.status === "published" && status("unpublish", "Unpublish")}
            {s.status !== "deactivated" && s.status !== "archived" && status("deactivate", "Deactivate", "ghost", "Deactivate this scholarship? It disappears from applicants; existing applications and history are preserved.")}
            {["deactivated", "archived", "expired"].includes(s.status) && status("reactivate", "Reactivate as draft", "ghost")}
            {s.status !== "archived" && status("archive", "Archive", "ghost", "Archive this scholarship?")}
            <ActionButton action={duplicateScholarshipAction} fields={{ id }} variant="ghost">Duplicate</ActionButton>
            <Link href={`/scholarships/${s.slug}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-royal-700 hover:bg-ivory-200">Preview <ExternalLink className="size-4" aria-hidden /></Link>
          </div>
          {s.status !== "published" && (problems.length ? <Alert tone="warning" title="Before this can be published"><ul className="list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul></Alert> : <Alert tone="success">Ready to publish.</Alert>)}
        </CardBody>
      </Card>

      <nav aria-label="Scholarship sections" className="mb-6 overflow-x-auto">
        <ul className="flex min-w-max gap-1 border-b border-line">
          {TABS.map(([k, l]) => <li key={k}><Link href={`/admin/scholarships/${id}?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={cn("block border-b-2 px-3 py-2 text-sm font-semibold", tab === k ? "border-gold-500 text-navy-900" : "border-transparent text-muted hover:text-navy-900")}>{l}</Link></li>)}
        </ul>
      </nav>

      {tab === "details" && <Card><CardBody className="p-5 sm:p-8"><ScholarshipForm s={s} /></CardBody></Card>}

      {tab === "sources" && (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader><CardTitle>Official sources</CardTitle></CardHeader>
            <CardBody>
              {b.sources.length === 0 ? <p className="text-sm text-muted">No sources yet. Every scholarship must link to the official partner university page.</p> : (
                <ul className="space-y-3">
                  {b.sources.map((src) => (
                    <li key={src.id} className="rounded-xl border border-line p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{src.sourceName} {src.isPrimary && <Badge tone="info">Primary</Badge>}</p><Badge tone={src.verificationStatus === "verified" ? "success" : src.verificationStatus === "outdated" ? "danger" : "warning"}>{src.verificationStatus}</Badge></div>
                      <a href={src.url} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-sm text-royal-700 underline">{src.url}</a>
                      <p className="mt-1 text-xs text-muted">{src.verifiedAt ? `Verified ${formatDateTime(src.verifiedAt)}` : "Not yet verified"}{src.notes ? ` · ${src.notes}` : ""}</p>
                      <div className="mt-2 flex gap-2">
                        <ActionButton action={sourceAction} fields={{ sourceId: src.id, op: "outdated" }} size="sm" variant="ghost">Mark outdated</ActionButton>
                        <ActionButton action={sourceAction} fields={{ sourceId: src.id, op: "remove" }} size="sm" variant="ghost" className="text-danger-700" confirm="Remove this source?">Remove</ActionButton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-sm">Last verified: <strong>{formatDateTime(s.lastVerifiedAt)}</strong></p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Add a source</CardTitle></CardHeader>
            <CardBody>
              <ActionForm action={addSourceAction} className="space-y-3" resetOnSuccess>
                <input type="hidden" name="id" value={id} />
                <div className="space-y-1"><Label htmlFor="sourceName">Source name</Label><Input id="sourceName" name="sourceName" placeholder="University — Scholarships page" /></div>
                <div className="space-y-1"><Label htmlFor="url">Official URL</Label><Input id="url" name="url" type="url" placeholder="https://" /></div>
                <div className="space-y-1"><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" className="min-h-16" /></div>
                <SubmitButton>Add source</SubmitButton>
              </ActionForm>
              <p className="mt-3 text-xs text-muted">SOAR Hub never scrapes or auto-publishes. An administrator must check the official page and mark it verified.</p>
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "criteria" && (
        <Card><CardBody className="p-5 sm:p-6">
          <CriteriaBuilder
            scholarshipId={id}
            initial={b.criteria.map(toDraft)}
            initialGroups={b.groups.map((g) => ({ key: g.id, name: g.name, logic: g.logic }))}
            fields={FIELDS.filter((f) => f.key !== "date_of_birth").map((f) => ({ key: f.key, label: f.label, type: f.type, options: f.options }))}
            operators={OPERATORS}
          />
        </CardBody></Card>
      )}

      {tab === "documents" && (
        <Card>
          <CardHeader><CardTitle>Required documents</CardTitle></CardHeader>
          <CardBody>
            <ActionForm action={saveRequirementsAction} className="space-y-3">
              <input type="hidden" name="id" value={id} />
              {[...b.requirements, ...Array.from({ length: 3 }, () => null)].map((r, i) => (
                <div key={r?.id ?? `new-${i}`} className="grid gap-2 rounded-lg border border-line p-3 md:grid-cols-[140px_180px_1fr_1fr_120px]">
                  <Select name="section" defaultValue={r?.section ?? "admission"} aria-label="Stage"><option value="admission">Admission</option><option value="scholarship">Scholarship</option></Select>
                  <Select name="category" defaultValue={r?.category ?? "other"} aria-label="Category">{DOCUMENT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select>
                  <Input name="name" defaultValue={r?.name ?? ""} placeholder={r ? "" : "New requirement name"} aria-label="Name" />
                  <Input name="description" defaultValue={r?.description ?? ""} placeholder="Description (optional)" aria-label="Description" />
                  <Select name="isRequired" defaultValue={r ? String(r.isRequired) : "true"} aria-label="Required"><option value="true">Required</option><option value="false">Optional</option></Select>
                </div>
              ))}
              <p className="text-xs text-muted">Clear a name to remove that requirement. Recommendation letters are fulfilled through the referee workflow.</p>
              <SubmitButton>Save required documents</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      )}

      {tab === "milestones" && <MilestoneEditor scholarshipId={id} rows={b.milestones.length ? b.milestones : (await templatesFor(id)).map((t) => ({ ...t, description: t.description ?? null, priority: t.priority ?? "medium", isRequired: t.isRequired !== false }))} usingDefault={b.milestones.length === 0} />}

      {tab === "rubric" && (
        <Card>
          <CardHeader><CardTitle>Essay critique rubric {b.rubric ? `(v${b.rubric.version})` : "(using platform default)"}</CardTitle></CardHeader>
          <CardBody>
            <ActionForm action={saveRubricAction} className="space-y-3">
              <input type="hidden" name="id" value={id} />
              <div className="space-y-1"><Label htmlFor="values">What this scholarship values</Label><Textarea id="values" name="values" defaultValue={b.rubric?.values ?? ""} className="min-h-16" placeholder="e.g. leadership, giving back, academic excellence" /></div>
              {[...((b.rubric?.dimensions as { label: string; guidance?: string }[]) ?? DEFAULT_RUBRIC), null, null].map((d, i) => (
                <div key={i} className="grid gap-2 md:grid-cols-[220px_1fr]"><Input name="label" defaultValue={d?.label ?? ""} placeholder="New dimension" aria-label="Dimension label" /><Input name="guidance" defaultValue={d?.guidance ?? ""} aria-label="Guidance" /></div>
              ))}
              <SubmitButton>Save rubric as new version</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      )}

      {tab === "files" && (
        <Card>
          <CardHeader><CardTitle>Supporting files (internal)</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <ul className="space-y-2 text-sm">{b.files.map((f) => <li key={f.id}><a href={`/api/admin/scholarship-files/${f.id}`} className="font-medium text-royal-700 underline">{f.name}</a> <span className="text-xs text-muted">· {fileSize(f.sizeBytes)} · {formatDateTime(f.createdAt)}</span></li>)}{b.files.length === 0 && <li className="text-muted">No files. Store a PDF copy of the official call for applications here for evidence.</li>}</ul>
            <ActionForm action={uploadScholarshipFileAction} className="flex flex-wrap items-end gap-2" resetOnSuccess>
              <input type="hidden" name="id" value={id} />
              <div className="space-y-1"><Label htmlFor="fname">Name</Label><Input id="fname" name="name" /></div>
              <div className="space-y-1"><Label htmlFor="ffile">File</Label><Input id="ffile" name="file" type="file" className="h-auto py-2" /></div>
              <SubmitButton variant="secondary">Upload</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      )}

      {tab === "history" && (
        <Card>
          <CardHeader><CardTitle>Revision history</CardTitle><Link href={`/admin/audit?targetId=${id}`} className="text-sm font-semibold text-royal-700">Audit log</Link></CardHeader>
          <CardBody>
            <ul className="divide-y divide-line text-sm">
              {(await revisions(id)).map((r) => (
                <li key={r.id} className="py-2">
                  <details>
                    <summary className="cursor-pointer"><strong>{r.reason}</strong> · {formatDateTime(r.createdAt)}</summary>
                    <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-ivory-200/60 p-3 text-xs">{JSON.stringify((r.snapshot as { scholarship: unknown }).scholarship, null, 2)}</pre>
                  </details>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </>
  );
}

