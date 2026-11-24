/** Upload validation by size, extension, declared MIME type AND magic bytes (pure). */
export type FileKind = "pdf" | "docx" | "jpeg" | "png";

export const KIND_INFO: Record<FileKind, { mime: string; extensions: string[]; label: string }> = {
  pdf: { mime: "application/pdf", extensions: ["pdf"], label: "PDF" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extensions: ["docx"], label: "Word (DOCX)" },
  jpeg: { mime: "image/jpeg", extensions: ["jpg", "jpeg"], label: "JPEG image" },
  png: { mime: "image/png", extensions: ["png"], label: "PNG image" },
};

export function sniffKind(bytes: Uint8Array): FileKind | null {
  const b = bytes;
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return "pdf"; // %PDF-
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "png";
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
    // ZIP container: require the OOXML word/ part to be present in the central directory
    const text = Buffer.from(b.subarray(0, Math.min(b.length, 2_000_000))).toString("latin1");
    if (text.includes("word/") && text.includes("[Content_Types].xml")) return "docx";
  }
  return null;
}

export interface ValidationInput {
  filename: string;
  declaredMime: string;
  size: number;
  bytes: Uint8Array;
  maxBytes: number;
  allowed: FileKind[];
}

export type ValidationResult = { ok: true; kind: FileKind; mime: string } | { ok: false; error: string };

export function validateUpload(i: ValidationInput): ValidationResult {
  const allowedLabels = i.allowed.map((k) => KIND_INFO[k].label).join(", ");
  if (i.size <= 0) return { ok: false, error: "The file is empty." };
  if (i.size > i.maxBytes) return { ok: false, error: `The file is too large. The maximum size is ${Math.round(i.maxBytes / 1024 / 1024)} MB.` };
  const ext = i.filename.toLowerCase().split(".").pop() ?? "";
  const byExt = (Object.keys(KIND_INFO) as FileKind[]).find((k) => KIND_INFO[k].extensions.includes(ext));
  if (!byExt || !i.allowed.includes(byExt)) return { ok: false, error: `This file type isn't accepted. Allowed: ${allowedLabels}.` };
  const sniffed = sniffKind(i.bytes);
  if (!sniffed) return { ok: false, error: "We couldn't recognise this file's contents. Please upload a genuine " + allowedLabels + " file." };
  if (sniffed !== byExt) return { ok: false, error: `The file's contents don't match its .${ext} extension.` };
  const declared = (i.declaredMime || "").toLowerCase();
  if (declared && declared !== "application/octet-stream" && declared !== KIND_INFO[sniffed].mime) {
    return { ok: false, error: "The file's type doesn't match its contents." };
  }
  return { ok: true, kind: sniffed, mime: KIND_INFO[sniffed].mime };
}

export function safeFilename(name: string): string {
  const base = name.replace(/[/\\]/g, "_").replace(/[^\w.\- ()]/g, "_").replace(/\s+/g, " ").trim();
  return (base || "file").slice(0, 150);
}

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/u).length : 0;
}
