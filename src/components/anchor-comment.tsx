"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/misc";
import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/utils";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

/**
 * Shows document/essay text; selecting a passage (mouse, touch or keyboard selection) fills the
 * anchored-comment form. The passage can also be typed/pasted directly for keyboard-only users.
 * Offsets are verified on the server against the exact version's text.
 */
export function AnchorCommentPanel({
  text,
  anchors,
  action,
  hidden,
  placeholder = "Explain what could be stronger and why…",
}: {
  text: string;
  anchors: { id: string; start: number; end: number; resolved?: boolean }[];
  action: Action;
  hidden: Record<string, string>;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<{ text: string; start: number; end: number } | null>(null);
  const [state, formAction, pending] = useActionState(action, null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      setSel(null);
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  const capture = () => {
    const s = window.getSelection();
    const root = ref.current;
    if (!s || s.rangeCount === 0 || !root) return;
    const range = s.getRangeAt(0);
    if (range.collapsed || !root.contains(range.commonAncestorContainer)) return;
    const pre = document.createRange();
    pre.selectNodeContents(root);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length;
    const selected = range.toString();
    if (selected.trim().length < 2) return;
    setSel({ text: selected, start, end: start + selected.length });
  };

  const sorted = [...anchors].filter((a) => a.start >= 0 && a.end <= text.length && a.end > a.start).sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let pos = 0;
  for (const a of sorted) {
    if (a.start < pos) continue;
    if (a.start > pos) parts.push(text.slice(pos, a.start));
    parts.push(<mark key={a.id} className={cn("anchor-mark", a.resolved && "opacity-50")}>{text.slice(a.start, a.end)}</mark>);
    pos = a.end;
  }
  parts.push(text.slice(pos));

  return (
    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <div
        ref={ref}
        onMouseUp={capture}
        onKeyUp={capture}
        onTouchEnd={capture}
        tabIndex={0}
        aria-label="Text to review. Select a passage to comment on it."
        className="max-h-[640px] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-ivory/40 p-4 font-serif text-[15px] leading-7"
      >
        {parts}
      </div>
      <form ref={formRef} action={formAction} className="space-y-3 lg:sticky lg:top-24 lg:self-start">
        {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <input type="hidden" name="startOffset" value={sel?.start ?? ""} />
        <input type="hidden" name="endOffset" value={sel?.end ?? ""} />
        {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
        {state?.ok && <Alert tone="success">{state.message ?? "Saved."}</Alert>}
        <div className="space-y-1.5">
          <Label htmlFor="selectedText">Highlighted passage (optional)</Label>
          <Textarea
            id="selectedText"
            name="selectedText"
            value={sel?.text ?? ""}
            onChange={(e) => setSel(e.target.value ? { text: e.target.value, start: -1, end: -1 } : null)}
            className="min-h-16 text-sm italic"
            placeholder="Select text on the left, or paste an exact passage. Leave empty for a general comment."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="body">Comment</Label>
          <Textarea id="body" name="body" required placeholder={placeholder} />
        </div>
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" aria-hidden />}{sel ? "Add anchored comment" : "Add general comment"}</Button>
      </form>
    </div>
  );
}
