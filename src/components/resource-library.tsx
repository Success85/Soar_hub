import Link from "next/link";
import { BookOpen, Lock, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";
import { Badge, EmptyState } from "@/components/ui/misc";
import { allTags, CONTENT_TYPES, listCategories, listResources } from "@/lib/services/content";
import { formatDate } from "@/lib/utils";

export async function ResourceLibrary({ searchParams: sp, basePath, includeApplicantOnly }: { searchParams: Record<string, string | undefined>; basePath: string; includeApplicantOnly?: boolean }) {
  const [rows, cats, tags] = await Promise.all([listResources({ q: sp.q, category: sp.category, tag: sp.tag, type: sp.type, includeApplicantOnly }), listCategories(), allTags()]);
  return (
    <>
      <form method="get" role="search" aria-label="Search resources" className="grid gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <div className="space-y-1.5"><Label htmlFor="rq">Search</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden /><Input id="rq" name="q" defaultValue={sp.q} className="pl-9" placeholder="Essays, CV, interviews…" /></div></div>
        <div className="space-y-1.5"><Label htmlFor="rc">Category</Label><Select id="rc" name="category" defaultValue={sp.category ?? ""}><option value="">All</option>{cats.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</Select></div>
        <div className="space-y-1.5"><Label htmlFor="rt">Type</Label><Select id="rt" name="type" defaultValue={sp.type ?? ""}><option value="">All types</option>{CONTENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></div>
        <Button type="submit">Search</Button>
      </form>
      {tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Tags">
          {tags.map((t) => <Link key={t.id} href={`${basePath}?tag=${t.slug}`} className={`rounded-full border px-3 py-1 text-xs font-medium ${sp.tag === t.slug ? "border-navy-900 bg-navy-900 text-ivory" : "border-line bg-white hover:bg-ivory-200"}`}>#{t.name}</Link>)}
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState className="mt-6" icon={BookOpen} title="No resources found" description="Try a different search or category." />
      ) : (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ r, category, tags: t }) => (
            <li key={r.id} className="relative flex flex-col rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
              {r.featuredImageUrl?.startsWith("/previews/") && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.featuredImageUrl} alt="" className="-mx-5 -mt-5 mb-4 h-40 w-[calc(100%+2.5rem)] rounded-t-[var(--radius-card)] border-b border-line bg-ivory object-cover object-top" />
              )}
              <div className="flex flex-wrap gap-2"><Badge tone="gold">{CONTENT_TYPES.find((c) => c.value === r.type)?.label}</Badge>{r.visibility === "applicants" && <Badge><Lock className="size-3" aria-hidden /> Members</Badge>}</div>
              <h3 className="mt-3 font-semibold leading-snug"><Link href={`/resources/${r.slug}`} className="after:absolute after:inset-0 hover:underline">{r.title}</Link></h3>
              {r.description && <p className="mt-2 line-clamp-3 text-sm text-muted">{r.description}</p>}
              <p className="mt-auto pt-4 text-xs text-muted">{category?.name ?? "General"} · {formatDate(r.publishedAt)}{t.length ? ` · ${t.slice(0, 3).join(", ")}` : ""}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
