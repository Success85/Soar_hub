import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink, FileText, Lock } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { CONTENT_TYPES, getResource } from "@/lib/services/content";
import { formatDate } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const r = await getResource({ slug: (await params).slug });
  if (!r || r.r.status !== "published") return { title: "Resource not found" };
  return { title: r.r.seoTitle ?? r.r.title, description: r.r.seoDescription ?? r.r.description ?? undefined };
}

function embedUrl(url: string): string | null {
  const yt = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/.exec(url);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = /vimeo\.com\/(\d+)/.exec(url);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

/** Files hosted by SOAR Hub itself (public/downloads) get a download card instead of an external link. */
function localFile(url: string | null) {
  if (!url?.startsWith("/downloads/")) return null;
  const ext = url.split(".").pop()?.toUpperCase() ?? "FILE";
  return { url, ext: ext === "PNG" || ext === "JPG" ? `${ext} image` : ext, name: url.split("/").pop()! };
}

export default async function ResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const [r, user] = await Promise.all([getResource({ slug: (await params).slug }), getCurrentUser()]);
  const isEditor = !!user?.permissions.has("content.manage");
  if (!r || ((r.r.status !== "published" || (r.r.publishedAt && r.r.publishedAt > new Date())) && !isEditor)) notFound();
  const gated = r.r.visibility === "applicants" && !user;
  const video = r.r.type === "video" && r.r.externalUrl ? embedUrl(r.r.externalUrl) : null;
  const file = localFile(r.r.externalUrl);
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/resources" className="text-sm font-medium text-royal-700 hover:underline">← Learning resources</Link>
      <div className="mt-4 flex flex-wrap gap-2"><Badge tone="gold">{CONTENT_TYPES.find((c) => c.value === r.r.type)?.label}</Badge>{r.category && <Badge>{r.category.name}</Badge>}{r.r.status !== "published" && <Badge tone="warning">{r.r.status} — editor preview</Badge>}</div>
      <h1 className="mt-4 font-display text-4xl leading-tight">{r.r.title}</h1>
      {r.r.description && <p className="mt-3 text-lg text-muted">{r.r.description}</p>}
      <p className="mt-3 text-sm text-muted">{r.r.authorName ?? (r.author ? `${r.author.firstName} ${r.author.lastName}` : "SOAR Hub")} · {formatDate(r.r.publishedAt)}</p>
      {r.r.featuredImageUrl && !gated && !file && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.r.featuredImageUrl} alt="" className="mt-8 w-full rounded-2xl border border-line object-cover" />
      )}
      {gated ? (
        <div className="mt-10 rounded-2xl border border-line bg-white p-8 text-center">
          <Lock className="mx-auto size-8 text-gold-600" aria-hidden />
          <p className="mt-3 font-semibold">This resource is for SOAR Hub members</p>
          <p className="mt-1 text-sm text-muted">Create a free account to read it.</p>
          <div className="mt-5 flex justify-center gap-2"><Button asChild><Link href="/register">Create free account</Link></Button><Button asChild variant="secondary"><Link href={`/login?next=/resources/${r.r.slug}`}>Sign in</Link></Button></div>
        </div>
      ) : (
        <div className="mt-10 space-y-6">
          {file && (
            <section aria-labelledby="file-title" className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center">
              {r.r.featuredImageUrl && (
                <a href={file.url} target="_blank" rel="noopener" className="shrink-0 self-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.r.featuredImageUrl} alt={`Preview of the first page of ${r.r.title}`} width={150} height={200} className="h-[200px] w-[150px] rounded-lg border border-line bg-white object-cover object-top" />
                </a>
              )}
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-gold-700"><FileText className="size-4" aria-hidden /> Sample document · {file.ext}</p>
                <h2 id="file-title" className="mt-1 text-lg font-semibold">{r.r.title}</h2>
                <p className="mt-1 text-sm text-muted">Download it, then read the explanation below. Use it to learn the structure. Never copy it word for word.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild><a href={file.url} download={file.name}><Download aria-hidden /> Download {file.ext}</a></Button>
                  <Button asChild variant="secondary"><a href={file.url} target="_blank" rel="noopener">Open in a new tab <ExternalLink aria-hidden /></a></Button>
                </div>
              </div>
            </section>
          )}
          {video && <div className="aspect-video overflow-hidden rounded-2xl border border-line"><iframe src={video} title={r.r.title} className="size-full" allow="encrypted-media; picture-in-picture" allowFullScreen /></div>}
          <Markdown>{r.r.body}</Markdown>
          {r.r.externalUrl && !video && !file && <a href={r.r.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-semibold text-royal-700 underline">{r.r.type === "download" ? "Download resource" : r.r.type === "webinar" ? "Webinar details" : "Open resource"} <ExternalLink className="size-4" aria-hidden /></a>}
          {r.tags.length > 0 && <div className="flex flex-wrap gap-2 border-t border-line pt-6">{r.tags.map((t) => <Link key={t.slug} href={`/resources?tag=${t.slug}`} className="rounded-full border border-line bg-white px-3 py-1 text-xs">#{t.name}</Link>)}</div>}
        </div>
      )}
    </article>
  );
}
