import { uploadDocumentAction } from "@/app/actions/workspace";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Input, Label, Select } from "@/components/ui/form";
import { DOCUMENT_CATEGORIES } from "@/lib/engine/fields";
import { KIND_INFO, type FileKind } from "@/lib/engine/file-validation";

export function UploadForm({
  allowed,
  maxMb,
  documentId,
  applicationId,
  requirementId,
  category,
  applications,
}: {
  allowed: FileKind[];
  maxMb: number;
  documentId?: string;
  applicationId?: string | null;
  requirementId?: string | null;
  category?: string | null;
  applications?: { id: string; name: string }[];
}) {
  const accept = allowed.flatMap((k) => [KIND_INFO[k].mime, ...KIND_INFO[k].extensions.map((e) => `.${e}`)]).join(",");
  return (
    <ActionForm action={uploadDocumentAction} className="space-y-4" resetOnSuccess>
      {documentId && <input type="hidden" name="documentId" value={documentId} />}
      {requirementId && <input type="hidden" name="requirementId" value={requirementId} />}
      {!documentId && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="category">Document type</Label>
            <Select id="category" name="category" defaultValue={category ?? "academic_transcript"}>
              {DOCUMENT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">Name (optional)</Label>
            <Input id="title" name="title" placeholder="e.g. WAEC result 2025" />
          </div>
          {applications && applications.length > 0 && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="applicationId">Attach to application (optional)</Label>
              <Select id="applicationId" name="applicationId" defaultValue={applicationId ?? ""}>
                <option value="">Not linked yet — keep in my library</option>
                {applications.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
          )}
        </div>
      )}
      {documentId && <input type="hidden" name="category" value={category ?? "other"} />}
      <div className="space-y-1.5">
        <Label htmlFor="file">{documentId ? "Upload a new version" : "File"}</Label>
        <Input id="file" name="file" type="file" accept={accept} required className="h-auto py-2 file:mr-3 file:rounded-md file:border-0 file:bg-navy-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ivory" aria-describedby="file-hint" />
        <p id="file-hint" className="text-xs text-muted">Accepted: {allowed.map((k) => KIND_INFO[k].label).join(", ")} · up to {maxMb} MB. Files are stored privately and checked for type and size.{documentId ? " Earlier versions are kept." : ""}</p>
        <FieldError name="file" />
      </div>
      <SubmitButton pendingLabel="Uploading securely…">{documentId ? "Upload new version" : "Upload document"}</SubmitButton>
    </ActionForm>
  );
}
