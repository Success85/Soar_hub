"use client";

import { Lightbulb, Loader2 } from "lucide-react";
import { useActionState } from "react";
import { searchAnswersAction } from "@/app/actions/workspace";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/misc";

export function AnswerSuggestions({ prompt }: { prompt: string }) {
  const [state, action, pending] = useActionState(searchAnswersAction, null);
  return (
    <div className="space-y-3">
      <form action={action} className="space-y-2">
        <label htmlFor="bank-prompt" className="sr-only">Prompt to search with</label>
        <Textarea id="bank-prompt" name="prompt" defaultValue={prompt} className="min-h-16 text-sm" />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Lightbulb aria-hidden />} Find my relevant stories
        </Button>
      </form>
      {state && !state.ok && <p className="text-sm text-danger-700">{state.error}</p>}
      {state?.ok && state.data && (
        <div className="space-y-2" aria-live="polite">
          <Badge tone={state.data.mode === "semantic" ? "success" : "neutral"}>{state.data.mode === "semantic" ? "Semantic search" : "Keyword search (fallback)"}</Badge>
          {state.data.note && <p className="text-xs text-muted">{state.data.note}</p>}
          {state.data.matches.length === 0 ? (
            <p className="text-sm text-muted">No matching entries in your answer bank yet.</p>
          ) : (
            <ul className="space-y-2">
              {state.data.matches.map((m) => (
                <li key={m.id} className="rounded-lg border border-line bg-white p-3">
                  <p className="text-sm font-semibold">{m.title}</p>
                  <p className="mt-1 line-clamp-3 text-xs text-muted">{m.excerpt}</p>
                  <p className="mt-2 text-xs text-navy-700"><strong>Why it may help:</strong> {m.why}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted">Use these as inspiration — rewrite them for this prompt in your own words.</p>
        </div>
      )}
    </div>
  );
}
