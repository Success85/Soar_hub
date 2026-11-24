import { approveCritiqueAction, rejectCritiqueAction } from "@/app/actions/review";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import type { Critique } from "@/lib/integrations/ai";

/** Reviewer edits the AI critique field by field, then approves (publishes) or rejects it. */
export function CritiqueEditor({ approvalId, c }: { approvalId: string; c: Critique }) {
  const ta = (name: string, label: string, items: string[], hint = "One item per line.") => (
    <div className="space-y-1.5">
      <Label htmlFor={`${name}-${approvalId}`}>{label}</Label>
      <p className="text-xs text-muted">{hint}</p>
      <Textarea id={`${name}-${approvalId}`} name={name} defaultValue={items.join("\n")} className="min-h-24 text-sm" />
    </div>
  );
  return (
    <div className="space-y-6">
      <ActionForm action={approveCritiqueAction} className="space-y-5">
        <input type="hidden" name="approvalId" value={approvalId} />
        <div className="space-y-1.5"><Label htmlFor={`sum-${approvalId}`}>Overall summary</Label><Textarea id={`sum-${approvalId}`} name="overall_summary" defaultValue={c.overall_summary} className="text-sm" /></div>
        <div className="grid gap-4 md:grid-cols-2">
          {ta("strengths", "Strengths", c.strengths)}
          {ta("areas_for_improvement", "Areas for improvement", c.areas_for_improvement)}
          {ta("evidence_gaps", "Evidence gaps", c.evidence_gaps)}
          {ta("questions_to_consider", "Questions to consider", c.questions_to_consider)}
        </div>
        {ta("revision_priorities", "Revision priorities", c.revision_priorities.map((p) => p.action), "One per line, most important first.")}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Specific observations</legend>
          {c.specific_observations.map((o, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-line p-3 md:grid-cols-[1fr_1.5fr]">
              <Input name="obs_quote" defaultValue={o.quote} aria-label={`Observation ${i + 1} quote`} className="text-sm italic" />
              <Textarea name="obs_text" defaultValue={o.observation} aria-label={`Observation ${i + 1}`} className="min-h-16 text-sm" />
            </div>
          ))}
          <p className="text-xs text-muted">Clear an observation&apos;s text to remove it.</p>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Rubric evaluation</legend>
          {c.rubric_evaluation.map((r, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-line p-3 md:grid-cols-[180px_160px_1fr] md:items-start">
              <Input name="rubric_dimension" defaultValue={r.dimension} aria-label="Dimension" className="text-sm" readOnly />
              <Select name="rubric_rating" defaultValue={r.rating} aria-label={`${r.dimension} rating`} className="text-sm">
                <option value="strong">Strong</option><option value="developing">Developing</option><option value="needs_work">Needs work</option><option value="not_applicable">N/A</option>
              </Select>
              <Textarea name="rubric_comment" defaultValue={r.comment} aria-label={`${r.dimension} comment`} className="min-h-14 text-sm" />
            </div>
          ))}
        </fieldset>
        <div className="grid gap-3 md:grid-cols-[180px_1fr]">
          <div className="space-y-1.5"><Label htmlFor={`wc-${approvalId}`}>Word count compliant?</Label><Select id={`wc-${approvalId}`} name="wc_compliant" defaultValue={c.word_count_compliance.compliant === null ? "" : String(c.word_count_compliance.compliant)}><option value="">Not applicable</option><option value="true">Yes</option><option value="false">No</option></Select></div>
          <div className="space-y-1.5"><Label htmlFor={`wcn-${approvalId}`}>Word count note</Label><Input id={`wcn-${approvalId}`} name="wc_note" defaultValue={c.word_count_compliance.note} /></div>
        </div>
        <div className="space-y-1.5"><Label htmlFor={`notes-${approvalId}`}>Internal reviewer notes (not shown to applicant)</Label><Textarea id={`notes-${approvalId}`} name="notes" className="min-h-16 text-sm" /></div>
        <SubmitButton pendingLabel="Publishing…">Approve & publish to applicant</SubmitButton>
      </ActionForm>
      <ActionForm action={rejectCritiqueAction} className="space-y-3 rounded-xl border border-red-200 bg-danger-100/30 p-4">
        <input type="hidden" name="approvalId" value={approvalId} />
        <div className="space-y-1.5"><Label htmlFor={`rej-${approvalId}`}>Reason (required to reject)</Label><Textarea id={`rej-${approvalId}`} name="notes" className="min-h-16 text-sm" /></div>
        <div className="flex flex-wrap gap-2">
          <SubmitButton variant="danger" name="decision" value="rejected">Reject critique</SubmitButton>
          <SubmitButton variant="secondary" name="decision" value="needs_more_review">Request additional review</SubmitButton>
        </div>
        <p className="text-xs text-muted">Rejected critiques are never shown to the applicant.</p>
      </ActionForm>
    </div>
  );
}
