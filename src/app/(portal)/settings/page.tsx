import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { changePasswordAction } from "@/app/actions/auth";
import { preferencesAction } from "@/app/actions/portal";
import { downloadExportAction, requestDeletionAction, requestExportAction } from "@/app/actions/workspace";
import { ActionButton, ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox, Input, Label, Textarea } from "@/components/ui/form";
import { Alert, Badge, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { notificationPreferences, profiles } from "@/lib/db/schema";
import { smsStatus } from "@/lib/integrations/sms";
import { userDataRequests } from "@/lib/services/privacy";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings & privacy" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser({ verified: false });
  const [[prefs], [profile], requests] = await Promise.all([
    db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, user.id)).limit(1),
    db.select({ phone: profiles.phone }).from(profiles).where(eq(profiles.userId, user.id)).limit(1),
    userDataRequests(user.id),
  ]);
  const p = prefs ?? { emailEnabled: true, smsEnabled: false, inAppEnabled: true, milestoneReminders: true, overdueReminders: true, refereeUpdates: true, feedbackUpdates: true };
  const sms = smsStatus();
  const exports = requests.filter((r) => r.type === "export" && r.status === "completed");
  return (
    <>
      <PageHeader title="Settings & privacy" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle>Notifications</CardTitle><CardDescription>Choose how we remind you. Security emails (verification, password reset) are always sent.</CardDescription></div></CardHeader>
          <CardBody>
            <ActionForm action={preferencesAction} className="space-y-4" successMessage="Saved.">
              <fieldset className="space-y-3"><legend className="text-sm font-semibold">Channels</legend>
                <Checkbox id="emailEnabled" name="emailEnabled" defaultChecked={p.emailEnabled} label="Email" />
                <Checkbox id="inAppEnabled" name="inAppEnabled" defaultChecked={p.inAppEnabled} label="In-app notifications" />
                <Checkbox id="smsEnabled" name="smsEnabled" defaultChecked={p.smsEnabled} label={<>SMS reminders one day before a task is due {!profile?.phone && <span className="text-xs text-warning-700">(add a phone number in your profile first)</span>}{!sms.configured && <span className="block text-xs text-muted">SMS delivery isn&apos;t enabled on this platform yet; your choice will apply once it is.</span>}</>} />
              </fieldset>
              <fieldset className="space-y-3"><legend className="text-sm font-semibold">Topics</legend>
                <Checkbox id="milestoneReminders" name="milestoneReminders" defaultChecked={p.milestoneReminders} label="Upcoming task reminders (7 days, 1 day and on the due date)" />
                <Checkbox id="overdueReminders" name="overdueReminders" defaultChecked={p.overdueReminders} label="Overdue task reminders" />
                <Checkbox id="refereeUpdates" name="refereeUpdates" defaultChecked={p.refereeUpdates} label="Referee updates" />
                <Checkbox id="feedbackUpdates" name="feedbackUpdates" defaultChecked={p.feedbackUpdates} label="Feedback on documents and essays" />
              </fieldset>
              <SubmitButton>Save preferences</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><div><CardTitle>Change password</CardTitle><CardDescription>Changing your password signs you out on other devices.</CardDescription></div></CardHeader>
          <CardBody>
            <ActionForm action={changePasswordAction} className="space-y-4" resetOnSuccess>
              <div className="space-y-1.5"><Label htmlFor="currentPassword">Current password</Label><Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" /><FieldError name="currentPassword" /></div>
              <div className="space-y-1.5"><Label htmlFor="newPassword">New password</Label><Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" /><FieldError name="newPassword" /></div>
              <div className="space-y-1.5"><Label htmlFor="confirmPassword">Confirm new password</Label><Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" /><FieldError name="confirmPassword" /></div>
              <SubmitButton>Change password</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><div><CardTitle>Download your data</CardTitle><CardDescription>Get a copy of the personal data SOAR Hub holds about you (NDPR right of access).</CardDescription></div></CardHeader>
          <CardBody className="space-y-4">
            <ActionButton action={requestExportAction} variant="secondary" pendingLabel="Preparing…">Generate my data export</ActionButton>
            {exports.length > 0 && (
              <ul className="space-y-2 text-sm">
                {exports.slice(0, 3).map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                    <span>Export from {formatDateTime(r.completedAt)}</span>
                    <ActionButton action={downloadExportAction} fields={{ requestId: r.id }} size="sm" variant="ghost">Download JSON</ActionButton>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted">Exports can be downloaded for 7 days.</p>
          </CardBody>
        </Card>

        <Card className="border-red-200">
          <CardHeader><div><CardTitle>Delete my account</CardTitle><CardDescription>We&apos;ll erase or anonymise your personal data within 30 days. Some records may be kept where the law requires.</CardDescription></div></CardHeader>
          <CardBody>
            {requests.some((r) => r.type === "deletion" && r.status === "pending") ? (
              <Alert tone="warning">A deletion request is already pending.</Alert>
            ) : (
              <ActionForm action={requestDeletionAction} className="space-y-4">
                <div className="space-y-1.5"><Label htmlFor="reason">Why are you leaving? (optional)</Label><Textarea id="reason" name="reason" className="min-h-16" /></div>
                <div className="space-y-1.5"><Label htmlFor="confirm">Type DELETE to confirm</Label><Input id="confirm" name="confirm" autoComplete="off" /><FieldError name="confirm" /></div>
                <SubmitButton variant="danger">Request account deletion</SubmitButton>
              </ActionForm>
            )}
            {requests.filter((r) => r.type === "deletion").map((r) => <p key={r.id} className="mt-3 text-xs text-muted">Deletion request {formatDateTime(r.requestedAt)} <Badge>{r.status}</Badge></p>)}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
