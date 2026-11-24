import type { Critique } from "@/lib/integrations/ai";
import { Badge } from "@/components/ui/misc";

const RATING = { strong: ["success", "Strong"], developing: ["gold", "Developing"], needs_work: ["warning", "Needs work"], not_applicable: ["neutral", "N/A"] } as const;

export function CritiqueView({ c }: { c: Critique }) {
  const List = ({ title, items }: { title: string; items: string[] }) =>
    items.length ? (
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{items.map((i, k) => <li key={k}>{i}</li>)}</ul>
      </div>
    ) : null;
  return (
    <div className="space-y-4">
      <p className="text-[15px]">{c.overall_summary}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <List title="Strengths" items={c.strengths} />
        <List title="Areas to improve" items={c.areas_for_improvement} />
      </div>
      {c.revision_priorities.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold">Revision priorities</h4>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">{c.revision_priorities.map((p) => <li key={p.priority}>{p.action}</li>)}</ol>
        </div>
      )}
      {c.specific_observations.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold">Specific observations</h4>
          <ul className="mt-1 space-y-2">{c.specific_observations.map((o, k) => <li key={k} className="text-sm"><blockquote className="border-l-4 border-gold-500 pl-3 italic text-muted">“{o.quote}”</blockquote><p className="mt-1">{o.observation}</p></li>)}</ul>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <List title="Evidence gaps" items={c.evidence_gaps} />
        <List title="Questions to consider" items={c.questions_to_consider} />
      </div>
      {c.rubric_evaluation.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold">Rubric</h4>
          <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
            {c.rubric_evaluation.map((r) => (
              <li key={r.dimension} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-start sm:gap-3">
                <span className="w-44 shrink-0 text-sm font-medium">{r.dimension}</span>
                <Badge tone={RATING[r.rating][0]}>{RATING[r.rating][1]}</Badge>
                <span className="text-sm text-muted">{r.comment}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-sm"><strong>Word count:</strong> {c.word_count_compliance.note}</p>
    </div>
  );
}
