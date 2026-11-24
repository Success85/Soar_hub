"use client";

import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { previewCriteriaAction, saveCriteriaAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { Alert, Badge } from "@/components/ui/misc";
import type { CriterionResult } from "@/lib/engine/eligibility";

export interface FieldOpt {
  key: string;
  label: string;
  type: string;
  options?: { value: string; label: string }[];
}
export interface OperatorOpt {
  value: string;
  label: string;
  needsValue: "none" | "single" | "list" | "range";
}

export interface CriterionDraft {
  id?: string;
  name: string;
  description: string;
  fieldKey: string;
  operator: string;
  value: string; // single value or comma list
  min: string;
  max: string;
  severity: "absolute" | "important" | "advisory";
  isFixable: boolean;
  isRequired: boolean;
  passExplanation: string;
  failExplanation: string;
  recommendedAction: string;
  sourceReference: string;
  questionText: string;
  answerType: string;
  answerOptions: string;
  groupKey: string;
}

const blank = (): CriterionDraft => ({ name: "", description: "", fieldKey: "age", operator: "lte", value: "", min: "", max: "", severity: "important", isFixable: true, isRequired: true, passExplanation: "", failExplanation: "", recommendedAction: "", sourceReference: "", questionText: "", answerType: "boolean", answerOptions: "", groupKey: "" });

function toPayloadValue(c: CriterionDraft, op?: OperatorOpt, field?: FieldOpt): unknown {
  if (!op || op.needsValue === "none") return null;
  if (op.needsValue === "range") return [c.min === "" ? null : Number(c.min), c.max === "" ? null : Number(c.max)];
  if (op.needsValue === "list") return c.value.split(",").map((s) => s.trim()).filter(Boolean);
  if (field?.type === "number" || ["gt", "gte", "lt", "lte"].includes(c.operator)) return c.value === "" ? null : Number(c.value);
  if (c.value === "true" || c.value === "false") return c.value === "true";
  return c.value;
}

const SAMPLE = JSON.stringify({ dateOfBirth: "2006-05-01", countryOfCitizenship: "Nigeria", educationLevel: "secondary_completed", qualifications: ["WASSCE"], creditPasses: 6, demonstratesFinancialNeed: true, firstGeneration: true, uploadedDocumentCategories: ["cv"], custom: {} }, null, 2);

export function CriteriaBuilder({ scholarshipId, initial, initialGroups, fields, operators }: { scholarshipId: string; initial: CriterionDraft[]; initialGroups: { key: string; name: string; logic: "and" | "or" }[]; fields: FieldOpt[]; operators: OperatorOpt[] }) {
  const [items, setItems] = useState<CriterionDraft[]>(initial.length ? initial : [blank()]);
  const [groups, setGroups] = useState(initialGroups);
  const [sample, setSample] = useState(SAMPLE);
  const [saveState, saveAction, saving] = useActionState(saveCriteriaAction, null);
  const [prevState, prevAction, previewing] = useActionState(previewCriteriaAction, null);
  const router = useRouter();
  useEffect(() => {
    if (saveState?.ok) router.refresh();
  }, [saveState, router]);

  const update = (i: number, patch: Partial<CriterionDraft>) => setItems((xs) => xs.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) => setItems((xs) => { const ys = [...xs]; const j = i + d; if (j < 0 || j >= ys.length) return xs; [ys[i], ys[j]] = [ys[j], ys[i]]; return ys; });
  const payload = JSON.stringify({
    groups,
    criteria: items.map((c) => {
      const op = operators.find((o) => o.value === c.operator);
      const field = fields.find((f) => f.key === c.fieldKey);
      const isCustom = c.fieldKey.startsWith("custom.");
      return {
        id: c.id,
        name: c.name,
        description: c.description || null,
        fieldKey: c.fieldKey,
        operator: c.operator,
        requiredValue: toPayloadValue(c, op, field),
        severity: c.severity,
        isFixable: c.severity === "absolute" ? false : c.isFixable,
        isRequired: c.isRequired,
        passExplanation: c.passExplanation || null,
        failExplanation: c.failExplanation || null,
        recommendedAction: c.recommendedAction || null,
        sourceReference: c.sourceReference || null,
        questionText: isCustom ? c.questionText || null : null,
        answerType: isCustom ? c.answerType || null : null,
        answerOptions: isCustom && c.answerOptions ? c.answerOptions.split(",").map((s) => s.trim()).filter(Boolean) : null,
        groupKey: c.groupKey || null,
      };
    }),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line bg-ivory/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Condition groups</p>
          <Button type="button" size="sm" variant="secondary" onClick={() => setGroups((g) => [...g, { key: `g${Date.now().toString(36)}`, name: `Group ${g.length + 1}`, logic: "or" }])}><Plus aria-hidden /> Add group</Button>
        </div>
        <p className="mt-1 text-xs text-muted">Ungrouped criteria must all pass (AND). Within a group choose AND (all) or OR (any one). Groups are combined with AND.</p>
        <ul className="mt-3 space-y-2">
          {groups.map((g, gi) => (
            <li key={g.key} className="flex flex-wrap items-center gap-2">
              <Input aria-label="Group name" value={g.name} onChange={(e) => setGroups((xs) => xs.map((x, k) => (k === gi ? { ...x, name: e.target.value } : x)))} className="h-9 w-56" />
              <Select aria-label="Group logic" value={g.logic} onChange={(e) => setGroups((xs) => xs.map((x, k) => (k === gi ? { ...x, logic: e.target.value as "and" | "or" } : x)))} className="h-9 w-40"><option value="or">Any one (OR)</option><option value="and">All (AND)</option></Select>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setGroups((xs) => xs.filter((_, k) => k !== gi)); setItems((xs) => xs.map((x) => (x.groupKey === g.key ? { ...x, groupKey: "" } : x))); }}>Remove</Button>
            </li>
          ))}
        </ul>
      </div>

      <ol className="space-y-4">
        {items.map((c, i) => {
          const op = operators.find((o) => o.value === c.operator);
          const field = fields.find((f) => f.key === c.fieldKey);
          const isCustom = c.fieldKey.startsWith("custom.");
          const p = `c${i}`;
          return (
            <li key={i} className="rounded-xl border border-line bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">Criterion {i + 1} {c.severity === "absolute" && <Badge tone="danger">Absolute</Badge>} {!c.isRequired && <Badge>Advisory</Badge>}</p>
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="ghost" onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp aria-hidden /></Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown aria-hidden /></Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => setItems((xs) => xs.filter((_, k) => k !== i))} aria-label="Remove criterion"><Trash2 aria-hidden /></Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1"><Label htmlFor={`${p}-name`}>Name</Label><Input id={`${p}-name`} value={c.name} onChange={(e) => update(i, { name: e.target.value })} /></div>
                <div className="space-y-1">
                  <Label htmlFor={`${p}-field`}>Applicant field</Label>
                  <Select id={`${p}-field`} value={isCustom ? "__custom" : c.fieldKey} onChange={(e) => update(i, { fieldKey: e.target.value === "__custom" ? `custom.question_${i + 1}` : e.target.value })}>
                    {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    <option value="__custom">Custom question…</option>
                  </Select>
                </div>
                <div className="space-y-1"><Label htmlFor={`${p}-op`}>Operator</Label><Select id={`${p}-op`} value={c.operator} onChange={(e) => update(i, { operator: e.target.value })}>{operators.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></div>
                {isCustom && (
                  <>
                    <div className="space-y-1"><Label htmlFor={`${p}-ck`}>Custom key</Label><Input id={`${p}-ck`} value={c.fieldKey} onChange={(e) => update(i, { fieldKey: e.target.value.startsWith("custom.") ? e.target.value.replace(/[^a-z0-9_.]/gi, "_").toLowerCase() : `custom.${e.target.value}` })} /></div>
                    <div className="space-y-1 md:col-span-2"><Label htmlFor={`${p}-q`}>Question shown to applicants</Label><Input id={`${p}-q`} value={c.questionText} onChange={(e) => update(i, { questionText: e.target.value })} /></div>
                    <div className="space-y-1"><Label htmlFor={`${p}-at`}>Answer type</Label><Select id={`${p}-at`} value={c.answerType} onChange={(e) => update(i, { answerType: e.target.value })}><option value="boolean">Yes / No</option><option value="enum">Choice</option><option value="number">Number</option><option value="string">Text</option></Select></div>
                    {c.answerType === "enum" && <div className="space-y-1 md:col-span-2"><Label htmlFor={`${p}-ao`}>Choices (comma separated)</Label><Input id={`${p}-ao`} value={c.answerOptions} onChange={(e) => update(i, { answerOptions: e.target.value })} /></div>}
                  </>
                )}
                {op?.needsValue === "single" && <div className="space-y-1"><Label htmlFor={`${p}-v`}>Required value</Label>{field?.options && !["gt", "gte", "lt", "lte"].includes(c.operator) ? <Select id={`${p}-v`} value={c.value} onChange={(e) => update(i, { value: e.target.value })}><option value="">Select…</option>{field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select> : <Input id={`${p}-v`} value={c.value} onChange={(e) => update(i, { value: e.target.value })} inputMode={field?.type === "number" ? "decimal" : undefined} />}</div>}
                {op?.needsValue === "list" && <div className="space-y-1 md:col-span-2"><Label htmlFor={`${p}-l`}>Allowed values (comma separated)</Label><Input id={`${p}-l`} value={c.value} onChange={(e) => update(i, { value: e.target.value })} placeholder={field?.options?.slice(0, 3).map((o) => o.value).join(", ")} /></div>}
                {op?.needsValue === "range" && (
                  <>
                    <div className="space-y-1"><Label htmlFor={`${p}-min`}>Minimum</Label><Input id={`${p}-min`} type="number" value={c.min} onChange={(e) => update(i, { min: e.target.value })} /></div>
                    <div className="space-y-1"><Label htmlFor={`${p}-max`}>Maximum</Label><Input id={`${p}-max`} type="number" value={c.max} onChange={(e) => update(i, { max: e.target.value })} /></div>
                  </>
                )}
                <div className="space-y-1"><Label htmlFor={`${p}-sev`}>Severity</Label><Select id={`${p}-sev`} value={c.severity} onChange={(e) => update(i, { severity: e.target.value as CriterionDraft["severity"] })}><option value="absolute">Absolute (cannot be waived)</option><option value="important">Important</option><option value="advisory">Advisory</option></Select></div>
                <div className="space-y-1"><Label htmlFor={`${p}-req`}>Counts toward verdict?</Label><Select id={`${p}-req`} value={c.isRequired ? "1" : "0"} onChange={(e) => update(i, { isRequired: e.target.value === "1" })}><option value="1">Required</option><option value="0">Optional / advisory</option></Select></div>
                <div className="space-y-1"><Label htmlFor={`${p}-fix`}>Fixable by applicant?</Label><Select id={`${p}-fix`} value={c.isFixable ? "1" : "0"} disabled={c.severity === "absolute"} onChange={(e) => update(i, { isFixable: e.target.value === "1" })}><option value="1">Yes</option><option value="0">No</option></Select></div>
                <div className="space-y-1"><Label htmlFor={`${p}-g`}>Group</Label><Select id={`${p}-g`} value={c.groupKey} onChange={(e) => update(i, { groupKey: e.target.value })}><option value="">None (AND)</option>{groups.map((g) => <option key={g.key} value={g.key}>{g.name}</option>)}</Select></div>
                <div className="space-y-1 md:col-span-3"><Label htmlFor={`${p}-d`}>Description (shown to applicants)</Label><Input id={`${p}-d`} value={c.description} onChange={(e) => update(i, { description: e.target.value })} /></div>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-royal-700">Explanations, action & source</summary>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="space-y-1"><Label htmlFor={`${p}-pe`}>Explanation when met</Label><Textarea id={`${p}-pe`} value={c.passExplanation} onChange={(e) => update(i, { passExplanation: e.target.value })} className="min-h-16 text-sm" placeholder="Auto-generated if empty" /></div>
                  <div className="space-y-1"><Label htmlFor={`${p}-fe`}>Explanation when not met</Label><Textarea id={`${p}-fe`} value={c.failExplanation} onChange={(e) => update(i, { failExplanation: e.target.value })} className="min-h-16 text-sm" placeholder="Auto-generated if empty" /></div>
                  <div className="space-y-1"><Label htmlFor={`${p}-ra`}>Recommended action</Label><Textarea id={`${p}-ra`} value={c.recommendedAction} onChange={(e) => update(i, { recommendedAction: e.target.value })} className="min-h-16 text-sm" /></div>
                  <div className="space-y-1"><Label htmlFor={`${p}-sr`}>Source reference</Label><Input id={`${p}-sr`} value={c.sourceReference} onChange={(e) => update(i, { sourceReference: e.target.value })} placeholder="e.g. Official eligibility page, section 2" /></div>
                </div>
              </details>
            </li>
          );
        })}
      </ol>
      <Button type="button" variant="secondary" onClick={() => setItems((xs) => [...xs, blank()])} disabled={items.length >= 50}><Plus aria-hidden /> Add criterion ({items.length}/50)</Button>

      <form action={saveAction} className="space-y-3 border-t border-line pt-4">
        <input type="hidden" name="id" value={scholarshipId} />
        <input type="hidden" name="payload" value={payload} />
        {saveState && !saveState.ok && <Alert tone="danger">{saveState.error}</Alert>}
        {saveState?.ok && <Alert tone="success">{saveState.message}</Alert>}
        <Button type="submit" size="lg" disabled={saving}>{saving && <Loader2 className="animate-spin" aria-hidden />} Validate & save criteria</Button>
      </form>

      <section className="rounded-xl border border-line bg-white p-4">
        <h3 className="font-semibold">Preview against a sample applicant</h3>
        <p className="mt-1 text-xs text-muted">Edit the sample profile (profile field names, plus uploadedDocumentCategories and custom answers) and test the unsaved rules. Nothing is stored.</p>
        <form action={prevAction} className="mt-3 space-y-3">
          <input type="hidden" name="id" value={scholarshipId} />
          <input type="hidden" name="payload" value={payload} />
          <Textarea name="sample" aria-label="Sample applicant JSON" value={sample} onChange={(e) => setSample(e.target.value)} className="min-h-48 font-mono text-xs" />
          <Button type="submit" variant="secondary" disabled={previewing}>{previewing && <Loader2 className="animate-spin" aria-hidden />} Run preview</Button>
        </form>
        {prevState && !prevState.ok && <Alert tone="danger" className="mt-3">{prevState.error}</Alert>}
        {prevState?.ok && prevState.data && (
          <div className="mt-4 space-y-2" aria-live="polite">
            <p className="font-semibold">Overall: {prevState.data.result.overall.replace(/_/g, " ")}</p>
            <ul className="space-y-1 text-sm">
              {prevState.data.result.results.map((r: CriterionResult) => (
                <li key={r.criterionId} className="flex flex-wrap items-start gap-2"><Badge tone={r.verdict === "eligible" ? "success" : r.verdict === "ineligible" ? "danger" : "warning"}>{r.verdict}</Badge> <span><strong>{r.criterionName}:</strong> {r.explanation}</span></li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
