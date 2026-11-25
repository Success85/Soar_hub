import { saveProfileAction } from "@/app/actions/portal";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/form";
import { EDUCATION_LEVELS, EMPLOYMENT_STATUSES, GENDERS, INCOME_BANDS, NIGERIAN_STATES, QUALIFICATIONS } from "@/lib/engine/fields";
import type { ProfileRow } from "@/lib/services/profile";

export type ProfileSection = "personal" | "education" | "background" | "goals" | "consent";

function F({ name, label, hint, optional, children }: { name: string; label: string; hint?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {optional && <span className="ml-1.5 text-xs font-normal text-muted">(optional)</span>}
      </Label>
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
      {children}
      <FieldError name={name} />
    </div>
  );
}

function YesNo({ name, value, allowSkip }: { name: string; value: boolean | null | undefined; allowSkip?: boolean }) {
  const v = value === true ? "true" : value === false ? "false" : "";
  return (
    <Select id={name} name={name} defaultValue={v}>
      <option value="">{allowSkip ? "Prefer not to say" : "Select…"}</option>
      <option value="true">Yes</option>
      <option value="false">No</option>
    </Select>
  );
}

const WHY = "text-[13px] leading-relaxed text-muted bg-ivory-200/70 rounded-lg px-3 py-2";

export function ProfileForm({
  profile,
  user,
  sections,
  hasConsent,
  submitLabel = "Save profile",
  step,
  redirectTo,
}: {
  profile: Partial<ProfileRow> | null;
  user: { firstName: string; lastName: string; email: string };
  sections: ProfileSection[];
  hasConsent: boolean;
  submitLabel?: string;
  step?: string;
  redirectTo?: string;
}) {
  const p = profile ?? {};
  const has = (s: ProfileSection) => sections.includes(s);
  return (
    <ActionForm action={saveProfileAction} className="space-y-10" successMessage="Profile saved." redirectOnSuccess={redirectTo}>
      {step && <input type="hidden" name="step" value={step} />}
      {has("personal") && (
        <fieldset className="space-y-5">
          <legend className="text-lg font-semibold">Personal details</legend>
          <p className={WHY}>We use these to check age, citizenship and residence requirements, and to send reminders. Your phone number is optional.</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <F name="firstName" label="First name">
              <Input id="firstName" name="firstName" defaultValue={user.firstName} autoComplete="given-name" />
            </F>
            <F name="lastName" label="Last name">
              <Input id="lastName" name="lastName" defaultValue={user.lastName} autoComplete="family-name" />
            </F>
            <F name="dateOfBirth" label="Date of birth" hint="We calculate your age from this.">
              <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={p.dateOfBirth ?? ""} max={new Date().toISOString().slice(0, 10)} />
            </F>
            <F name="gender" label="Gender" optional hint="Only used if a scholarship has a gender-specific criterion.">
              <Select id="gender" name="gender" defaultValue={p.gender ?? ""}>
                <option value="">Prefer not to say</option>
                {GENDERS.filter((g) => g.value !== "prefer_not_to_say").map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </Select>
            </F>
            <F name="countryOfCitizenship" label="Country of citizenship">
              <Input id="countryOfCitizenship" name="countryOfCitizenship" defaultValue={p.countryOfCitizenship ?? ""} placeholder="Nigeria" list="countries" />
            </F>
            <F name="countryOfResidence" label="Country of residence">
              <Input id="countryOfResidence" name="countryOfResidence" defaultValue={p.countryOfResidence ?? ""} placeholder="Nigeria" list="countries" />
            </F>
            <F name="stateOfOrigin" label="State of origin">
              <Select id="stateOfOrigin" name="stateOfOrigin" defaultValue={p.stateOfOrigin ?? ""}>
                <option value="">Select your state…</option>
                {NIGERIAN_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value="Outside Nigeria">Outside Nigeria</option>
              </Select>
            </F>
            <F name="phone" label="Phone number" optional hint="Optional, e.g. 0803 123 4567">
              <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={p.phone ?? ""} />
            </F>
          </div>
          <p className="text-sm text-muted">Email: <strong className="text-navy-900">{user.email}</strong> (change this from Settings by contacting support)</p>
          <datalist id="countries">
            {["Nigeria", "Ghana", "Kenya", "Rwanda", "South Africa", "Uganda", "Ethiopia", "Cameroon", "Niger", "Chad", "Benin", "Other"].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </fieldset>
      )}

      {has("education") && (
        <fieldset className="space-y-5">
          <legend className="text-lg font-semibold">Education</legend>
          <p className={WHY}>Universities set academic requirements. Add what you have now — you can update it when new results come out.</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <F name="educationLevel" label="Current education level">
              <Select id="educationLevel" name="educationLevel" defaultValue={p.educationLevel ?? ""}>
                <option value="">Select…</option>
                {EDUCATION_LEVELS.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </Select>
            </F>
            <F name="currentSchool" label="School">
              <Input id="currentSchool" name="currentSchool" defaultValue={p.currentSchool ?? ""} autoComplete="organization" />
            </F>
            <F name="graduationYear" label="Secondary school graduation year" hint="Expected year if you haven't finished.">
              <Input id="graduationYear" name="graduationYear" type="number" inputMode="numeric" min={1990} max={2040} defaultValue={p.graduationYear ?? ""} />
            </F>
            <F name="creditPasses" label="Credit passes (C6 or better)" hint="WASSCE/NECO, including English and Maths.">
              <Input id="creditPasses" name="creditPasses" type="number" inputMode="numeric" min={0} max={15} defaultValue={p.creditPasses ?? ""} />
            </F>
            <F name="gradeAverage" label="Grade average (%)" optional>
              <Input id="gradeAverage" name="gradeAverage" type="number" inputMode="decimal" step="0.1" min={0} max={100} defaultValue={p.gradeAverage ?? ""} />
            </F>
          </div>
          <fieldset>
            <legend className="text-sm font-semibold">Academic qualifications</legend>
            <input type="hidden" name="$qualifications" value="1" />
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {QUALIFICATIONS.map((q) => (
                <Checkbox key={q.value} id={`q-${q.value}`} name="qualifications" value={q.value} defaultChecked={p.qualifications?.includes(q.value)} label={q.label} />
              ))}
            </div>
            <FieldError name="qualifications" />
          </fieldset>
          <F name="academicResultsSummary" label="Results summary" optional hint="e.g. WASSCE 2025: A1 Maths, B2 English, B3 Physics…">
            <Textarea id="academicResultsSummary" name="academicResultsSummary" defaultValue={p.academicResultsSummary ?? ""} />
          </F>
        </fieldset>
      )}

      {has("background") && (
        <fieldset className="space-y-5">
          <legend className="text-lg font-semibold">Background</legend>
          <p className={WHY}>Many fully funded scholarships prioritise applicants facing barriers. Sensitive questions are <strong>optional</strong> — leave them as “Prefer not to say” unless you want them considered. Only you and authorised SOAR Hub staff can see these answers.</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <F name="firstGeneration" label="Would you be the first in your immediate family to attend university?">
              <YesNo name="firstGeneration" value={p.firstGeneration} />
            </F>
            <F name="employmentStatus" label="Employment status">
              <Select id="employmentStatus" name="employmentStatus" defaultValue={p.employmentStatus ?? ""}>
                <option value="">Select…</option>
                {EMPLOYMENT_STATUSES.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </Select>
            </F>
            <F name="householdIncomeBand" label="Household income level" optional>
              <Select id="householdIncomeBand" name="householdIncomeBand" defaultValue={p.householdIncomeBand ?? ""}>
                <option value="">Prefer not to say</option>
                {INCOME_BANDS.filter((b) => b.value !== "prefer_not_to_say").map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </Select>
            </F>
            <F name="demonstratesFinancialNeed" label="Would you need significant financial support to attend university?" optional>
              <YesNo name="demonstratesFinancialNeed" value={p.demonstratesFinancialNeed} allowSkip />
            </F>
            <F name="hasDisability" label="Do you identify as a person with a disability?" optional>
              <YesNo name="hasDisability" value={p.hasDisability} allowSkip />
            </F>
            <F name="isRefugeeOrDisplaced" label="Are you a refugee or forcibly displaced?" optional>
              <YesNo name="isRefugeeOrDisplaced" value={p.isRefugeeOrDisplaced} allowSkip />
            </F>
          </div>
        </fieldset>
      )}

      {has("goals") && (
        <fieldset className="space-y-5">
          <legend className="text-lg font-semibold">Goals</legend>
          <p className={WHY}>This helps us recommend scholarships and gives reviewers context when they support you.</p>
          <F name="preferredProgramme" label="What would you like to study?">
            <Input id="preferredProgramme" name="preferredProgramme" defaultValue={p.preferredProgramme ?? ""} placeholder="e.g. Computer Science" />
          </F>
          <F name="careerInterests" label="Career interests">
            <Textarea id="careerInterests" name="careerInterests" defaultValue={p.careerInterests ?? ""} placeholder="What do you hope to do after university?" />
          </F>
          <F name="personalBackground" label="Personal background" hint="A few sentences about where you're from and what has shaped you. Relevant for need- and impact-based scholarships.">
            <Textarea id="personalBackground" name="personalBackground" defaultValue={p.personalBackground ?? ""} />
          </F>
        </fieldset>
      )}

      {has("consent") && (
        <fieldset className="space-y-3">
          <legend className="text-lg font-semibold">Your consent</legend>
          <input type="hidden" name="$consentField" value="1" />
          <Checkbox
            id="dataProcessingConsent"
            name="dataProcessingConsent"
            defaultChecked={hasConsent}
            label="I consent to SOAR Hub processing the information in my profile to assess my eligibility and support my applications, as described in the privacy policy. I can withdraw this consent at any time."
          />
        </fieldset>
      )}

      <div className="flex flex-wrap gap-3">
        <SubmitButton size="lg">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
