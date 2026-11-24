"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useActionState } from "react";
import { refereeUploadAction } from "@/app/actions/referee";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";

export function RefereeUploadForm({ token, maxMb, refereeName, applicantName }: { token: string; maxMb: number; refereeName: string; applicantName: string }) {
  const [state, action, pending] = useActionState(refereeUploadAction, null);
  if (state?.ok) {
    return (
      <div className="text-center" role="status">
        <CheckCircle2 className="mx-auto size-14 text-success-700" aria-hidden />
        <h2 className="mt-4 font-display text-2xl">Thank you — your letter has been received</h2>
        <p className="mt-2 text-muted">{applicantName} has been notified. A confirmation has been emailed to you. This link is now closed and can&apos;t be used again.</p>
      </div>
    );
  }
  const fe = state && !state.ok ? state.fieldErrors ?? {} : {};
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
      <div className="space-y-1.5">
        <Label htmlFor="file">Reference letter</Label>
        <Input id="file" name="file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="h-auto py-2" aria-describedby="file-hint" />
        <p id="file-hint" className="text-xs text-muted">PDF or Word (.docx), up to {maxMb} MB.</p>
        {fe.file && <p className="text-[13px] text-danger-700">{fe.file}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmedName">Type your full name to sign</Label>
        <Input id="confirmedName" name="confirmedName" defaultValue={refereeName} autoComplete="name" />
        {fe.confirmedName && <p className="text-[13px] text-danger-700">{fe.confirmedName}</p>}
      </div>
      <Checkbox id="declaration" name="declaration" label={`I confirm this letter was written by me and reflects my honest assessment of ${applicantName}.`} />
      {fe.declaration && <p className="text-[13px] text-danger-700">{fe.declaration}</p>}
      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">{pending && <Loader2 className="animate-spin" aria-hidden />} Submit reference letter</Button>
    </form>
  );
}
