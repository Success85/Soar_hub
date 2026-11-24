import type { Metadata } from "next";
import { Library } from "lucide-react";
import { deleteAnswerAction, saveAnswerAction } from "@/app/actions/workspace";
import { AnswerSuggestions } from "@/components/answer-suggestions";
import { ActionButton, ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { Badge, EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { embeddingsStatus } from "@/lib/integrations/embeddings";
import { ANSWER_CATEGORIES, listAnswers } from "@/lib/services/answer-bank";
import { EssayTabs } from "@/components/essay-tabs";

export const metadata: Metadata = { title: "Answer bank" };

function AnswerFields({ e }: { e?: { id: string; category: string; title: string; body: string; tags: string[] } }) {
  const p = e?.id ?? "new";
  return (
    <>
      {e && <input type="hidden" name="id" value={e.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor={`t-${p}`}>Title</Label><Input id={`t-${p}`} name="title" defaultValue={e?.title} /><FieldError name="title" /></div>
        <div className="space-y-1.5"><Label htmlFor={`c-${p}`}>Category</Label><Select id={`c-${p}`} name="category" defaultValue={e?.category ?? "personal_experience"}>{ANSWER_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></div>
      </div>
      <div className="space-y-1.5"><Label htmlFor={`b-${p}`}>Your story</Label><Textarea id={`b-${p}`} name="body" defaultValue={e?.body} className="min-h-32" /><FieldError name="body" /></div>
      <div className="space-y-1.5"><Label htmlFor={`g-${p}`}>Tags (comma separated)</Label><Input id={`g-${p}`} name="tags" defaultValue={e?.tags.join(", ")} /></div>
    </>
  );
}

export default async function AnswerBankPage() {
  const user = await requireUser();
  const entries = await listAnswers(user.id);
  const emb = embeddingsStatus();
  return (
    <>
      <PageHeader title="Essays & answer bank" description="Store your best stories once. When a new essay prompt arrives, we'll find the most relevant ones from your own bank — nobody else can see it." />
      <EssayTabs current="bank" />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          {entries.length === 0 ? (
            <EmptyState icon={Library} title="Your answer bank is empty" description="Add experiences, achievements, leadership stories and goals. They become building blocks for future essays." />
          ) : (
            entries.map((e) => (
              <details key={e.id} className="rounded-[var(--radius-card)] border border-line bg-white p-4">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{e.title}</p><Badge tone="gold">{ANSWER_CATEGORIES.find((c) => c.value === e.category)?.label}</Badge></div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{e.body}</p>
                  {e.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{e.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>}
                </summary>
                <ActionForm action={saveAnswerAction} className="mt-4 space-y-4 border-t border-line pt-4">
                  <AnswerFields e={e} />
                  <div className="flex gap-2"><SubmitButton variant="secondary">Save changes</SubmitButton></div>
                </ActionForm>
                <div className="mt-2"><ActionButton action={deleteAnswerAction} fields={{ id: e.id }} variant="ghost" size="sm" className="text-danger-700" confirm="Delete this entry?">Delete</ActionButton></div>
              </details>
            ))
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Add an entry</CardTitle></CardHeader>
            <CardBody><ActionForm action={saveAnswerAction} className="space-y-4" resetOnSuccess><AnswerFields /><SubmitButton>Add to answer bank</SubmitButton></ActionForm></CardBody>
          </Card>
          <Card>
            <CardHeader><CardTitle>Search with a prompt</CardTitle></CardHeader>
            <CardBody>
              <p className="mb-3 text-xs text-muted">{emb.configured ? "Semantic search is on: matches are found by meaning, not just words." : "Semantic search isn't configured on this platform, so keyword search is used instead."}</p>
              <AnswerSuggestions prompt="" />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
