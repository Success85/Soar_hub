import { createScholarshipAction, updateScholarshipAction } from "@/app/actions/admin";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/form";
import type { Scholarship } from "@/lib/services/scholarships";
import { CATEGORY_LABELS, CATEGORY_ORDER, WINDOW_LABELS, WINDOW_ORDER } from "@/lib/scholarship-meta";

/** Format an instant as a Lagos (UTC+1) datetime-local value. */
function lagosLocal(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d.getTime() + 3_600_000).toISOString().slice(0, 16);
}

export function ScholarshipForm({ s }: { s?: Scholarship }) {
  const F = ({ name, label, children, hint, className }: { name: string; label: string; children: React.ReactNode; hint?: string; className?: string }) => (
    <div className={`space-y-1.5 ${className ?? ""}`}><Label htmlFor={name}>{label}</Label>{hint && <p className="text-xs text-muted">{hint}</p>}{children}<FieldError name={name} /></div>
  );
  return (
    <ActionForm action={s ? updateScholarshipAction : createScholarshipAction} className="space-y-6">
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <F name="name" label="Scholarship name" className="md:col-span-2"><Input id="name" name="name" defaultValue={s?.name} required /></F>
        <F name="partnerUniversity" label="Partner university"><Input id="partnerUniversity" name="partnerUniversity" defaultValue={s?.partnerUniversity} /></F>
        <F name="slug" label="URL slug" hint="Leave blank to generate from the name."><Input id="slug" name="slug" defaultValue={s?.slug} /></F>
        <F name="country" label="Country"><Input id="country" name="country" defaultValue={s?.country} /></F>
        <F name="city" label="City"><Input id="city" name="city" defaultValue={s?.city ?? ""} /></F>
        <F name="programmeLevel" label="Programme level"><Select id="programmeLevel" name="programmeLevel" defaultValue={s?.programmeLevel ?? "undergraduate"}><option value="undergraduate">Undergraduate</option><option value="masters">Master&apos;s (future)</option><option value="doctoral">Doctoral (future)</option><option value="other">Other</option></Select></F>
        <F name="scholarshipType" label="Scholarship type"><Input id="scholarshipType" name="scholarshipType" defaultValue={s?.scholarshipType ?? "Fully funded"} /></F>
        <F name="programmes" label="Programmes covered" hint="Comma separated." className="md:col-span-2"><Input id="programmes" name="programmes" defaultValue={s?.programmes.join(", ")} /></F>
        <F name="summary" label="Short summary" className="md:col-span-2"><Input id="summary" name="summary" defaultValue={s?.summary ?? ""} maxLength={500} /></F>
        <F name="description" label="Overview (Markdown)" className="md:col-span-2"><Textarea id="description" name="description" defaultValue={s?.description} className="min-h-40" /></F>
      </div>
      <fieldset className="grid gap-4 md:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Application window & eligibility summary</legend>
        <F name="windowStatus" label="Window status" hint="Published scholarships stay visible between rounds; applications can only start while Open or Opens soon."><Select id="windowStatus" name="windowStatus" defaultValue={s?.windowStatus ?? "open"}>{WINDOW_ORDER.map((w) => <option key={w} value={w}>{WINDOW_LABELS[w]}</option>)}</Select></F>
        <F name="category" label="Group"><Select id="category" name="category" defaultValue={s?.category ?? ""}><option value="">—</option>{CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</Select></F>
        <F name="currentWindow" label="Deadline / current window (as worded officially)"><Input id="currentWindow" name="currentWindow" defaultValue={s?.currentWindow ?? ""} /></F>
        <F name="nextWindow" label="Next window"><Input id="nextWindow" name="nextWindow" defaultValue={s?.nextWindow ?? ""} /></F>
        <F name="logoUrl" label="School logo (image URL or /logos/ file)" className="md:col-span-2"><Input id="logoUrl" name="logoUrl" defaultValue={s?.logoUrl ?? ""} placeholder="/logos/www.ashesi.edu.gh.png" /></F>
        <F name="keyEligibility" label="Key eligibility (summary)" className="md:col-span-2"><Textarea id="keyEligibility" name="keyEligibility" defaultValue={s?.keyEligibility ?? ""} className="min-h-20" /></F>
        <F name="howToApply" label="How to apply" className="md:col-span-2"><Textarea id="howToApply" name="howToApply" defaultValue={s?.howToApply ?? ""} className="min-h-16" /></F>
        <F name="contactEmail" label="Application email (if applications are by email)"><Input id="contactEmail" name="contactEmail" type="email" defaultValue={s?.contactEmail ?? ""} /></F>
        <F name="researchSources" label="Research sources"><Input id="researchSources" name="researchSources" defaultValue={s?.researchSources ?? ""} placeholder="e.g. Official page; Scholars4Dev" /></F>
      </fieldset>
      <fieldset className="grid gap-4 md:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Benefits</legend>
        <F name="tuitionCoverage" label="Tuition coverage"><Input id="tuitionCoverage" name="tuitionCoverage" defaultValue={s?.tuitionCoverage ?? ""} /></F>
        <F name="livingAllowance" label="Living allowance"><Input id="livingAllowance" name="livingAllowance" defaultValue={s?.livingAllowance ?? ""} /></F>
        <F name="accommodationBenefits" label="Accommodation"><Input id="accommodationBenefits" name="accommodationBenefits" defaultValue={s?.accommodationBenefits ?? ""} /></F>
        <F name="travelBenefits" label="Travel"><Input id="travelBenefits" name="travelBenefits" defaultValue={s?.travelBenefits ?? ""} /></F>
        <F name="otherBenefits" label="Other benefits" className="md:col-span-2"><Input id="otherBenefits" name="otherBenefits" defaultValue={s?.otherBenefits ?? ""} /></F>
      </fieldset>
      <fieldset className="grid gap-4 md:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold">Dates & links</legend>
        <F name="openingDate" label="Applications open (Lagos time)"><Input id="openingDate" name="openingDate" type="datetime-local" defaultValue={lagosLocal(s?.openingDate)} /></F>
        <F name="deadline" label="Official deadline (Lagos time)" hint="Changing it recalculates applicants' plans."><Input id="deadline" name="deadline" type="datetime-local" defaultValue={lagosLocal(s?.deadline)} /></F>
        <F name="timezone" label="Timezone"><Select id="timezone" name="timezone" defaultValue={s?.timezone ?? "Africa/Lagos"}><option value="Africa/Lagos">Africa/Lagos (WAT)</option><option value="UTC">UTC</option></Select></F>
        <F name="applicationUrl" label="Official application URL" className="md:col-span-3"><Input id="applicationUrl" name="applicationUrl" type="url" defaultValue={s?.applicationUrl ?? ""} placeholder="https://" /></F>
      </fieldset>
      <Checkbox id="isFeatured" name="isFeatured" defaultChecked={s?.isFeatured} label="Feature this scholarship on the homepage" />
      <SubmitButton size="lg">{s ? "Save changes" : "Create draft"}</SubmitButton>
    </ActionForm>
  );
}
