import { saveMilestonesAction } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { DEFAULT_MILESTONES } from "@/lib/services/planner";

export function MilestoneEditor({ scholarshipId, rows, usingDefault }: { scholarshipId: string | null; rows: { key: string; name: string; description: string | null; durationDays: number; dependsOn: string[]; priority: string; isRequired: boolean }[]; usingDefault: boolean }) {
  const list = rows.length ? rows : DEFAULT_MILESTONES.map((t) => ({ ...t, description: t.description ?? null, priority: t.priority ?? "medium", isRequired: t.isRequired !== false }));
  return (
    <Card>
      <CardHeader><div><CardTitle>Milestone template</CardTitle><p className="mt-1 text-sm text-muted">{usingDefault ? "This scholarship currently uses the platform default. Saving here creates a scholarship-specific template." : "Scholarship-specific template."} Dependencies form a graph (no cycles); a final task with key “submit” is required. Durations are in days.</p></div></CardHeader>
      <CardBody>
        <ActionForm action={saveMilestonesAction} className="space-y-2">
          {scholarshipId && <input type="hidden" name="id" value={scholarshipId} />}
          <div className="hidden grid-cols-[130px_1fr_80px_1fr_110px_110px] gap-2 px-1 text-xs font-semibold text-muted md:grid"><span>Key</span><span>Name</span><span>Days</span><span>Depends on (keys)</span><span>Priority</span><span>Required</span></div>
          {[...list, null, null].map((m, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-line p-2 md:grid-cols-[130px_1fr_80px_1fr_110px_110px]">
              <Input name="key" defaultValue={m?.key ?? ""} aria-label="Key" placeholder="new_key" />
              <Input name="name" defaultValue={m?.name ?? ""} aria-label="Name" />
              <Input name="durationDays" type="number" min={1} defaultValue={m?.durationDays ?? 3} aria-label="Duration days" />
              <Input name="dependsOn" defaultValue={m?.dependsOn.join(", ") ?? ""} aria-label="Depends on" />
              <Select name="priority" defaultValue={m?.priority ?? "medium"} aria-label="Priority"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></Select>
              <Select name="isRequired" defaultValue={String(m?.isRequired ?? true)} aria-label="Required"><option value="true">Required</option><option value="false">Optional</option></Select>
              <input type="hidden" name="description" value={m?.description ?? ""} />
            </div>
          ))}
          <SubmitButton>Validate & save template</SubmitButton>
        </ActionForm>
      </CardBody>
    </Card>
  );
}
