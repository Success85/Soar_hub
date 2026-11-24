"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { createEssayAction, saveEssayAction } from "@/app/actions/workspace";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export function EssayEditor({
  essay,
  applications,
  locked,
  defaultApplicationId,
}: {
  essay?: { id: string; title: string; prompt: string; body: string; wordLimit: number | null; applicationId: string | null };
  applications: { id: string; name: string }[];
  locked?: boolean;
  defaultApplicationId?: string;
}) {
  const [state, action, pending] = useActionState(essay ? saveEssayAction : createEssayAction, null);
  const [body, setBody] = useState(essay?.body ?? "");
  const [limit, setLimit] = useState<number | null>(essay?.wordLimit ?? null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const over = limit ? words > limit : false;
  const err = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={action} className="space-y-4">
      {essay && <input type="hidden" name="essayId" value={essay.id} />}
      {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
      {state?.ok && state.message && <Alert tone="success">{state.message}</Alert>}
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="title">Essay title</Label>
          <Input id="title" name="title" defaultValue={essay?.title} required disabled={locked} aria-invalid={!!err.title} />
          {err.title && <p className="text-[13px] text-danger-700">{err.title}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wordLimit">Word limit</Label>
          <Input id="wordLimit" name="wordLimit" type="number" inputMode="numeric" min={50} defaultValue={essay?.wordLimit ?? ""} onChange={(e) => setLimit(e.target.value ? Number(e.target.value) : null)} disabled={locked} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="applicationId">Application</Label>
        <Select id="applicationId" name="applicationId" defaultValue={essay?.applicationId ?? defaultApplicationId ?? ""} disabled={locked}>
          <option value="">Not linked</option>
          {applications.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <p className="text-xs text-muted">Link an application so a reviewer can give feedback and the scholarship&apos;s rubric is used.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="prompt">Essay prompt / question</Label>
        <Textarea id="prompt" name="prompt" defaultValue={essay?.prompt} className="min-h-20" placeholder="Paste the exact question from the scholarship" disabled={locked} />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-end justify-between">
          <Label htmlFor="body">Your essay</Label>
          <span className={cn("text-sm font-semibold", over ? "text-danger-700" : "text-muted")} aria-live="polite">{words}{limit ? ` / ${limit}` : ""} words{over ? " — over the limit" : ""}</span>
        </div>
        <Textarea id="body" name="body" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[420px] font-serif text-[16px] leading-8" placeholder="Write in your own voice. Start with a specific moment…" disabled={locked} />
      </div>
      {essay && !locked && (
        <div className="space-y-1.5">
          <Label htmlFor="note">Version note (optional)</Label>
          <Input id="note" name="note" placeholder="e.g. Added community project example" />
        </div>
      )}
      {!locked && (
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {essay ? "Save draft" : "Create essay"}
        </Button>
      )}
    </form>
  );
}
