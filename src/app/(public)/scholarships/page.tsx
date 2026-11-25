import type { Metadata } from "next";
import Link from "next/link";
import { requireMemberPage } from "@/lib/auth/session";
import { GraduationCap, LayoutGrid, Rows3, Search } from "lucide-react";
import { ScholarshipCard, WindowBadge } from "@/components/scholarship-card";
import { SchoolLogo } from "@/components/school-logo";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";
import { EmptyState, Table, Td, Th } from "@/components/ui/misc";
import { CATEGORY_LABELS, CATEGORY_ORDER, CATEGORY_SHORT, WINDOW_LABELS, WINDOW_ORDER, type Category, type WindowStatus } from "@/lib/scholarship-meta";
import { listPublicScholarships, publicFacets } from "@/lib/services/scholarships";
import { cn, daysUntil, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Scholarships", description: "Mastercard Foundation Scholars Program partner opportunities — verified windows, eligibility and how to apply." };
export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

export default async function ScholarshipsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireMemberPage("/scholarships");
  const sp = await searchParams;
  const view = sp.view === "table" ? "table" : "cards";
  const [result, facets, openList] = await Promise.all([
    listPublicScholarships({ q: sp.q, country: sp.country, window: sp.window, category: sp.category, level: sp.level, sort: (sp.sort as never) ?? "status", pageSize: 100 }),
    publicFacets(),
    listPublicScholarships({ window: "open", pageSize: 100 }),
  ]);
  const closingSoon = openList.rows.filter((s) => {
    const d = daysUntil(s.deadline);
    return d !== null && d >= 0 && d <= 30;
  }).length;
  const href = (o: SP) => {
    const u = new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][]);
    return `/scholarships${u.size ? `?${u}` : ""}`;
  };
  const filtersActive = [sp.q, sp.country, sp.category, sp.level].filter(Boolean).length;
  const grouped = CATEGORY_ORDER.map((c) => ({ c, rows: result.rows.filter((r) => r.category === c) })).filter((g) => g.rows.length);
  const ungrouped = result.rows.filter((r) => !r.category);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">Mastercard Foundation Scholars Program</p>
      <h1 className="mt-2 font-display text-4xl">Partner scholarships</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Fully funded opportunities at partner universities in Africa and abroad. Each listing shows its current application window, when the next one is expected, key eligibility and how to apply. Information was last verified on the date shown — always confirm on the official page.
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Partner opportunities", facets.total, undefined],
          ["Open now", facets.windows.open ?? 0, "open"],
          ["Opening soon", facets.windows.opens_soon ?? 0, "opens_soon"],
          ["Open & closing within 30 days", closingSoon, "open"],
        ].map(([label, value, w]) => (
          <div key={label as string} className="relative rounded-[var(--radius-card)] border border-line bg-white p-4 hover:border-navy-600">
            <dt className="text-[13px] text-muted"><Link href={w ? href({ window: w as string }) : href({ window: undefined })} className="after:absolute after:inset-0">{label}</Link></dt>
            <dd className="mt-1 font-display text-3xl text-navy-900">{value as number}</dd>
          </div>
        ))}
      </dl>

      <nav aria-label="Filter by application window" className="mt-8 flex flex-wrap gap-2">
        <Link href={href({ window: undefined })} aria-current={!sp.window ? "page" : undefined} className={cn("rounded-full border px-4 py-1.5 text-sm font-semibold", !sp.window ? "border-navy-900 bg-navy-900 text-ivory" : "border-line bg-white hover:bg-ivory-200")}>All <span className="opacity-70">({facets.total})</span></Link>
        {WINDOW_ORDER.filter((w) => facets.windows[w]).map((w) => (
          <Link key={w} href={href({ window: w })} aria-current={sp.window === w ? "page" : undefined} className={cn("rounded-full border px-4 py-1.5 text-sm font-semibold", sp.window === w ? "border-navy-900 bg-navy-900 text-ivory" : "border-line bg-white hover:bg-ivory-200")}>
            {WINDOW_LABELS[w]} <span className="opacity-70">({facets.windows[w]})</span>
          </Link>
        ))}
      </nav>

      <form method="get" className="mt-4 rounded-[var(--radius-card)] border border-line bg-white p-4 sm:p-5" role="search" aria-label="Filter scholarships">
        {sp.window && <input type="hidden" name="window" value={sp.window} />}
        <input type="hidden" name="view" value={view} />
        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="q">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input id="q" name="q" defaultValue={sp.q} placeholder="University, field or keyword" className="pl-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Group</Label>
            <Select id="category" name="category" defaultValue={sp.category ?? ""}>
              <option value="">All groups</option>
              {CATEGORY_ORDER.filter((c) => facets.categories[c]).map((c) => <option key={c} value={c}>{CATEGORY_SHORT[c]} ({facets.categories[c]})</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="level">Level</Label>
            <Select id="level" name="level" defaultValue={sp.level ?? ""}>
              <option value="">All levels</option>
              <option value="undergraduate">Undergraduate ({facets.levels.undergraduate ?? 0})</option>
              <option value="masters">Postgraduate ({facets.levels.masters ?? 0})</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country">Country</Label>
            <Select id="country" name="country" defaultValue={sp.country ?? ""}>
              <option value="">Any country</option>
              {facets.countries.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sort">Sort by</Label>
            <Select id="sort" name="sort" defaultValue={sp.sort ?? "status"}>
              <option value="status">Open first</option>
              <option value="deadline">Closest deadline</option>
              <option value="name">Name</option>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="submit">Apply filters</Button>
          {filtersActive > 0 && <Link href={href({ q: undefined, country: undefined, category: undefined, level: undefined })} className="text-sm font-semibold text-royal-700 hover:underline">Clear filters</Link>}
          <p className="text-sm text-muted" aria-live="polite">{result.total} scholarship{result.total === 1 ? "" : "s"}</p>
          <div className="ml-auto flex rounded-lg border border-line p-1" role="group" aria-label="View">
            <Link href={href({ view: "cards" })} aria-current={view === "cards" ? "page" : undefined} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold", view === "cards" ? "bg-navy-900 text-ivory" : "hover:bg-ivory-200")}><LayoutGrid className="size-4" aria-hidden /> Cards</Link>
            <Link href={href({ view: "table" })} aria-current={view === "table" ? "page" : undefined} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold", view === "table" ? "bg-navy-900 text-ivory" : "hover:bg-ivory-200")}><Rows3 className="size-4" aria-hidden /> Table</Link>
          </div>
        </div>
      </form>

      {result.rows.length === 0 ? (
        <EmptyState className="mt-8" icon={GraduationCap} title="No scholarships match your filters" description="Try another status or remove a filter." action={<Button asChild variant="secondary"><Link href="/scholarships">Show all</Link></Button>} />
      ) : view === "table" ? (
        <Table className="mt-8" caption="Scholarships">
          <thead>
            <tr><Th>#</Th><Th>School</Th><Th>Country</Th><Th>Group</Th><Th>Level / eligible fields</Th><Th>Status</Th><Th>Deadline / current window</Th><Th>Next window</Th></tr>
          </thead>
          <tbody>
            {result.rows.map((s, i) => (
              <tr key={s.id} className="hover:bg-ivory/60">
                <Td className="text-muted">{i + 1}</Td>
                <Td className="min-w-56"><span className="flex items-center gap-2.5"><SchoolLogo name={s.partnerUniversity} logoUrl={s.logoUrl} size="sm" /><Link href={`/scholarships/${s.slug}`} className="font-semibold text-navy-900 hover:underline">{s.partnerUniversity}</Link></span></Td>
                <Td>{s.country}</Td>
                <Td className="whitespace-nowrap">{s.category ? CATEGORY_SHORT[s.category as Category] : "—"}</Td>
                <Td className="min-w-56 text-[13px]">{s.summary}</Td>
                <Td><WindowBadge status={s.windowStatus as WindowStatus} /></Td>
                <Td className="min-w-56 text-[13px]">{s.currentWindow ?? formatDate(s.deadline)}</Td>
                <Td className="min-w-48 text-[13px] text-muted">{s.nextWindow ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <div className="mt-10 space-y-12">
          {grouped.map(({ c, rows }) => (
            <section key={c} aria-labelledby={`group-${c}`}>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
                <h2 id={`group-${c}`} className="font-display text-2xl">{CATEGORY_LABELS[c as Category]}</h2>
                <p className="text-sm text-muted">
                  {rows.length} programme{rows.length === 1 ? "" : "s"} · {rows.filter((r) => r.windowStatus === "open").length} open now
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((s) => <ScholarshipCard key={s.id} s={s} />)}
              </div>
            </section>
          ))}
          {ungrouped.length > 0 && (
            <section aria-labelledby="group-other">
              <h2 id="group-other" className="mb-4 border-b border-line pb-2 font-display text-2xl">Other opportunities</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{ungrouped.map((s) => <ScholarshipCard key={s.id} s={s} />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
