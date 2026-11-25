"use client";

import { Check, Copy, IdCard } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Shows a member ID with a copy button. */
export function MemberCode({ code, size = "md", className }: { code: string; size?: "md" | "lg"; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable (e.g. insecure context): the code stays selectable */
    }
  };
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-lg border border-gold-500/50 bg-gold-50 text-navy-950", size === "lg" ? "px-4 py-2.5" : "px-2.5 py-1", className)}>
      <IdCard className={cn("shrink-0 text-gold-700", size === "lg" ? "size-5" : "size-4")} aria-hidden />
      <span className="sr-only">Member ID:</span>
      <span className={cn("select-all font-mono font-semibold tracking-wider", size === "lg" ? "text-xl" : "text-sm")}>{code}</span>
      <button type="button" onClick={copy} className="inline-flex size-7 items-center justify-center rounded-md text-navy-800 hover:bg-gold-200/60" aria-label={copied ? "Copied" : "Copy member ID"}>
        {copied ? <Check className="size-4 text-success-700" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      </button>
      <span aria-live="polite" className="sr-only">{copied ? "Member ID copied" : ""}</span>
    </span>
  );
}
