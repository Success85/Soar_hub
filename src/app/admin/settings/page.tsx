import { desc } from "drizzle-orm";
import { runJobAction, saveSettingsAction, sendTestEmailAction, testAiAction } from "@/app/actions/admin";
import { ActionButton, ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox, Input, Label, Textarea } from "@/components/ui/form";
import { Badge, PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { requirePermissionPage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { jobRuns } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { aiStatus } from "@/lib/integrations/ai";
import { emailStatus } from "@/lib/integrations/email";
import { flutterwaveStatus } from "@/lib/integrations/flutterwave";
import { embeddingsStatus } from "@/lib/integrations/embeddings";
import { malwareStatus } from "@/lib/integrations/malware";
import { smsStatus } from "@/lib/integrations/sms";
import { storageStatus } from "@/lib/integrations/storage";
import { JOBS } from "@/lib/services/jobs";
import { getSettings } from "@/lib/services/settings";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsAdmin() {
  await requirePermissionPage("settings.manage");
  const s = await getSettings();
  const runs = await db.select().from(jobRuns).orderBy(desc(jobRuns.startedAt)).limit(20);
  const integrations = [
    ["Email", emailStatus(), "EMAIL_PROVIDER, EMAIL_PROVIDER_API_KEY or SMTP_USER/SMTP_PASSWORD, EMAIL_FROM"],
    ["Payments", flutterwaveStatus(), "FLW_SECRET_KEY, FLW_SECRET_HASH"],
    ["SMS", smsStatus(), "SMS_PROVIDER, SMS_PROVIDER_API_KEY, SMS_PROVIDER_USERNAME"],
    ["AI critique", aiStatus(), "AI_PROVIDER, AI_API_KEY, AI_MODEL"],
    ["Semantic search", embeddingsStatus(), "EMBEDDINGS_PROVIDER, EMBEDDINGS_API_KEY"],
    ["File storage", storageStatus(), "STORAGE_DRIVER=s3, S3_* variables"],
    ["Malware scanning", malwareStatus(), "CLAMAV_HOST, CLAMAV_PORT"],
  ] as const;
  const F = ({ name, label, children, hint }: { name: string; label: string; children: React.ReactNode; hint?: string }) => <div className="space-y-1"><Label htmlFor={name}>{label}</Label>{hint && <p className="text-xs text-muted">{hint}</p>}{children}</div>;
  return (
    <>
      <PageHeader title="Platform settings" description="Non-secret configuration. API keys and other secrets are set only as environment variables on the server and are never shown in the browser." />
      <Card className="mb-6">
        <CardHeader><div><CardTitle>Integrations</CardTitle><CardDescription>Status is read from server environment variables.</CardDescription></div></CardHeader>
        <CardBody>
          <ul className="divide-y divide-line">
            {integrations.map(([name, st, vars]) => (
              <li key={name} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div><p className="font-semibold">{name}</p><p className="text-xs text-muted">{st.provider}{"model" in st && st.model ? ` · ${st.model}` : ""} · variables: {vars}</p></div>
                {st.configured ? <Badge tone="success">Active</Badge> : name === "SMS" ? <Badge>Off (not used in this version)</Badge> : <Badge tone="warning">Needs: {st.missing.join(", ")}</Badge>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Session idle timeout: {env.SESSION_IDLE_MINUTES} minutes (SESSION_IDLE_MINUTES). App URL: {env.APP_URL}.</p>
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardHeader><div><CardTitle>Test email delivery</CardTitle><CardDescription>Sends one email immediately through the configured provider ({emailStatus().provider}), from <span className="font-mono">{env.EMAIL_FROM}</span>.</CardDescription></div></CardHeader>
        <CardBody>
          {env.EMAIL_PROVIDER === "smtp" && env.SMTP_USER && !env.EMAIL_FROM.toLowerCase().includes(env.SMTP_USER.toLowerCase()) && (
            <p className="mb-4 rounded-lg border border-warning-700/30 bg-amber-50 p-3 text-sm text-amber-900">Gmail always sends as the signed-in account. Set EMAIL_FROM to <span className="font-mono">SOAR Hub &lt;{env.SMTP_USER}&gt;</span> so the sender shown matches.</p>
          )}
          {/your-domain/.test(env.EMAIL_FROM) && env.EMAIL_PROVIDER !== "console" && env.EMAIL_PROVIDER !== "smtp" && (
            <p className="mb-4 rounded-lg border border-warning-700/30 bg-amber-50 p-3 text-sm text-amber-900">EMAIL_FROM still uses the placeholder domain. Set it to an address on a domain you verified with your provider (or <span className="font-mono">SOAR Hub &lt;onboarding@resend.dev&gt;</span> for Resend testing).</p>
          )}
          <ActionForm action={sendTestEmailAction} className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1 space-y-1"><Label htmlFor="to">Send to</Label><Input id="to" name="to" type="email" placeholder="Leave empty to send to yourself" /><FieldError name="to" /></div>
            <SubmitButton variant="secondary" pendingLabel="Sending…">Send test email</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardHeader><div><CardTitle>Test AI critique</CardTitle><CardDescription>Runs one real critique on a short built-in sample essay ({aiStatus().provider}{aiStatus().model ? `, ${aiStatus().model}` : ""}). Costs a few US cents.</CardDescription></div></CardHeader>
        <CardBody>
          {aiStatus().configured ? (
            <ActionForm action={testAiAction}><SubmitButton variant="secondary" pendingLabel="Asking the AI… (up to a minute)">Run a test critique</SubmitButton></ActionForm>
          ) : (
            <p className="text-sm text-muted">Set <span className="font-mono">AI_PROVIDER=anthropic</span> and <span className="font-mono">AI_API_KEY</span> in <span className="font-mono">.env</span>, restart the app, then test here.</p>
          )}
        </CardBody>
      </Card>

      <ActionForm action={saveSettingsAction} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Brand & contact</CardTitle></CardHeader>
          <CardBody className="grid gap-4 md:grid-cols-2">
            <F name="platform_name" label="Platform name"><Input id="platform_name" name="platform_name" defaultValue={s.platform_name} /></F>
            <F name="support_email" label="Support email"><Input id="support_email" name="support_email" type="email" defaultValue={s.support_email} /></F>
            <F name="admin_alert_email" label="Admin alert email"><Input id="admin_alert_email" name="admin_alert_email" type="email" defaultValue={s.admin_alert_email} /></F>
            <F name="contact_phone" label="Contact phone"><Input id="contact_phone" name="contact_phone" defaultValue={s.contact_phone} /></F>
            <F name="contact_address" label="Contact address"><Input id="contact_address" name="contact_address" defaultValue={s.contact_address} /></F>
            <fieldset className="grid grid-cols-2 gap-3 md:col-span-2 md:grid-cols-4">
              <legend className="mb-1 text-sm font-semibold">Brand colours (applied site-wide; keep sufficient contrast)</legend>
              {Object.entries(s.brand_colors).map(([k, v]) => <F key={k} name={`brand_colors.${k}`} label={k}><Input id={`brand_colors.${k}`} name={`brand_colors.${k}`} defaultValue={v} pattern="#[0-9a-fA-F]{6}" /></F>)}
            </fieldset>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Uploads, reminders & time</CardTitle></CardHeader>
          <CardBody className="grid gap-4 md:grid-cols-2">
            <F name="upload_max_mb" label="Max upload size (MB)"><Input id="upload_max_mb" name="upload_max_mb" type="number" min={1} max={50} defaultValue={s.upload_max_mb} /></F>
            <F name="allowed_file_types" label="Allowed file types" hint="Comma separated: pdf, docx, jpeg, png"><input type="hidden" name="$allowed_file_types" value="1" /><Input id="allowed_file_types" name="allowed_file_types" defaultValue={s.allowed_file_types.join(", ")} /></F>
            <F name="reminder_offsets_days" label="Reminder days before due" hint="Comma separated, e.g. 7, 1, 0"><input type="hidden" name="$reminder_offsets_days" value="1" /><Input id="reminder_offsets_days" name="reminder_offsets_days" defaultValue={s.reminder_offsets_days.join(", ")} /></F>
            <F name="referee_link_days" label="Referee link validity (days)"><Input id="referee_link_days" name="referee_link_days" type="number" min={1} max={60} defaultValue={s.referee_link_days} /></F>
            <F name="timezone" label="Platform timezone"><Input id="timezone" name="timezone" defaultValue={s.timezone} /></F>
            <div className="space-y-3 md:col-span-2">
              <input type="hidden" name="$overdue_reminders_enabled" value="1" /><Checkbox id="overdue_reminders_enabled" name="overdue_reminders_enabled" defaultChecked={s.overdue_reminders_enabled} label="Send overdue task reminders" />
              {smsStatus().configured && <><input type="hidden" name="$sms_enabled" value="1" /><Checkbox id="sms_enabled" name="sms_enabled" defaultChecked={s.sms_enabled} label="Allow SMS reminders (for applicants who opt in)" /></>}
              <input type="hidden" name="$notify_admin_on_referee_submission" value="1" /><Checkbox id="notify_admin_on_referee_submission" name="notify_admin_on_referee_submission" defaultChecked={s.notify_admin_on_referee_submission} label="Email the admin alert address when a referee submits" />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Membership & payments</CardTitle><CardDescription>Members pay through Flutterwave to use everything beyond the home, About, Contact and FAQ pages. Staff accounts never pay.</CardDescription></div></CardHeader>
          <CardBody className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><input type="hidden" name="$membership_required" value="1" /><Checkbox id="membership_required" name="membership_required" defaultChecked={s.membership_required} label="Require a paid membership (turn off to open every feature to all signed-in users)" /></div>
            <F name="membership_price_ngn" label="Price (₦)" hint="What members pay through Flutterwave."><Input id="membership_price_ngn" name="membership_price_ngn" type="number" min={100} step={50} defaultValue={s.membership_price_ngn} /></F>
            <F name="membership_duration_months" label="Membership length (months)" hint="12 = yearly. 0 = one-time payment for lifetime access."><Input id="membership_duration_months" name="membership_duration_months" type="number" min={0} max={120} defaultValue={s.membership_duration_months} /></F>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>AI, registration & maintenance</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <input type="hidden" name="$ai_enabled" value="1" /><Checkbox id="ai_enabled" name="ai_enabled" defaultChecked={s.ai_enabled} label="Enable AI-assisted essay critique (always human-approved)" />
            <input type="hidden" name="$ai_auto_generate_on_submit" value="1" /><Checkbox id="ai_auto_generate_on_submit" name="ai_auto_generate_on_submit" defaultChecked={s.ai_auto_generate_on_submit} label="Generate a draft critique automatically when an essay is submitted" />
            <input type="hidden" name="$registration_open" value="1" /><Checkbox id="registration_open" name="registration_open" defaultChecked={s.registration_open} label="Allow new registrations" />
            <input type="hidden" name="$maintenance_mode" value="1" /><Checkbox id="maintenance_mode" name="maintenance_mode" defaultChecked={s.maintenance_mode} label="Show maintenance banner on public pages" />
            <F name="maintenance_message" label="Maintenance message"><Input id="maintenance_message" name="maintenance_message" defaultValue={s.maintenance_message} /></F>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Legal text</CardTitle><CardDescription>Leave empty to use the built-in templates. Have these reviewed by a qualified lawyer before launch.</CardDescription></div></CardHeader>
          <CardBody className="grid gap-4 md:grid-cols-2">
            <F name="privacy_version" label="Privacy policy version"><Input id="privacy_version" name="privacy_version" defaultValue={s.privacy_version} /></F>
            <F name="terms_version" label="Terms version"><Input id="terms_version" name="terms_version" defaultValue={s.terms_version} /></F>
            <F name="privacy_markdown" label="Privacy policy (Markdown)"><Textarea id="privacy_markdown" name="privacy_markdown" defaultValue={s.privacy_markdown} className="min-h-40 font-mono text-xs" /></F>
            <F name="terms_markdown" label="Terms of service (Markdown)"><Textarea id="terms_markdown" name="terms_markdown" defaultValue={s.terms_markdown} className="min-h-40 font-mono text-xs" /></F>
          </CardBody>
        </Card>
        <SubmitButton size="lg">Save settings</SubmitButton>
      </ActionForm>

      <Card className="mt-8">
        <CardHeader><div><CardTitle>Background jobs</CardTitle><CardDescription>Run automatically by the scheduler (see deployment guide). You can trigger a job manually here.</CardDescription></div></CardHeader>
        <CardBody>
          <div className="mb-4 flex flex-wrap gap-2">{Object.keys(JOBS).map((j) => <ActionButton key={j} action={runJobAction} fields={{ job: j }} size="sm" variant="secondary">{j}</ActionButton>)}</div>
          <Table caption="Recent job runs">
            <thead><tr><Th>Job</Th><Th>Started</Th><Th>Status</Th><Th>Result</Th></tr></thead>
            <tbody>{runs.map((r) => <tr key={r.id}><Td>{r.job}</Td><Td className="whitespace-nowrap text-xs">{formatDateTime(r.startedAt)}</Td><Td><Badge tone={r.status === "succeeded" ? "success" : r.status === "failed" ? "danger" : "info"}>{r.status}</Badge></Td><Td className="max-w-md truncate text-xs">{r.error ?? JSON.stringify(r.result)}</Td></tr>)}{runs.length === 0 && <tr><Td colSpan={4} className="text-center text-muted">No runs yet.</Td></tr>}</tbody>
          </Table>
        </CardBody>
      </Card>
    </>
  );
}
