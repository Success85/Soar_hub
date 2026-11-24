import { asc } from "drizzle-orm";
import { saveTemplateAction } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Input, Label, Textarea } from "@/components/ui/form";
import { Badge, PageHeader } from "@/components/ui/misc";
import { requirePermissionPage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { notificationTemplates } from "@/lib/db/schema";

export const metadata = { title: "Notification templates" };
export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  await requirePermissionPage("templates.manage");
  const rows = await db.select().from(notificationTemplates).orderBy(asc(notificationTemplates.key), asc(notificationTemplates.channel));
  return (
    <>
      <PageHeader back={{ href: "/admin/notifications", label: "Notifications" }} title="Notification templates" description="Use {{variable}} placeholders such as {{firstName}}, {{milestoneName}}, {{scholarshipName}}, {{dueDate}}. Variables are HTML-escaped in emails." />
      <div className="space-y-3">
        {rows.map((t) => (
          <details key={t.id} className="rounded-[var(--radius-card)] border border-line bg-white p-4">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2"><strong>{t.key}</strong><Badge tone="info">{t.channel}</Badge>{!t.isActive && <Badge tone="warning">Inactive (default used)</Badge>}<span className="text-sm text-muted">{t.description}</span></summary>
            <ActionForm action={saveTemplateAction} className="mt-4 space-y-3">
              <input type="hidden" name="id" value={t.id} />
              {t.channel !== "sms" && <div className="space-y-1"><Label htmlFor={`s-${t.id}`}>Subject</Label><Input id={`s-${t.id}`} name="subject" defaultValue={t.subject ?? ""} /></div>}
              <div className="space-y-1"><Label htmlFor={`b-${t.id}`}>Body</Label><Textarea id={`b-${t.id}`} name="body" defaultValue={t.body} className="min-h-32 text-sm" />{t.channel === "sms" && <p className="text-xs text-muted">Keep SMS under 160 characters where possible.</p>}</div>
              <Checkbox id={`a-${t.id}`} name="isActive" defaultChecked={t.isActive} label="Active" />
              <SubmitButton variant="secondary">Save template</SubmitButton>
            </ActionForm>
          </details>
        ))}
      </div>
    </>
  );
}
