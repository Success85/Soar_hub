import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveResourceAction, saveResourceAction } from "@/app/actions/admin";
import { ActionButton, ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { Alert, PageHeader } from "@/components/ui/misc";
import { requirePermissionPage } from "@/lib/auth/session";
import { CONTENT_TYPES, getResource, listCategories } from "@/lib/services/content";

export const metadata = { title: "Edit resource" };
export const dynamic = "force-dynamic";

export default async function EditResource({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requirePermissionPage("content.manage");
  const { id } = await params;
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const res = isNew ? null : await getResource({ id });
  if (!isNew && !res) notFound();
  const r = res?.r;
  const cats = await listCategories();
  const { created } = await searchParams;
  const F = ({ name, label, children, className }: { name: string; label: string; children: React.ReactNode; className?: string }) => <div className={`space-y-1.5 ${className ?? ""}`}><Label htmlFor={name}>{label}</Label>{children}<FieldError name={name} /></div>;
  return (
    <>
      <PageHeader back={{ href: "/admin/content", label: "Content" }} title={isNew ? "New resource" : r!.title} actions={r && <><Link href={`/resources/${r.slug}`} target="_blank" className="text-sm font-semibold text-royal-700 hover:underline">Preview</Link>{r.status !== "archived" && <ActionButton action={archiveResourceAction} fields={{ id: r.id }} variant="ghost" confirm="Archive this resource?">Archive</ActionButton>}</>} />
      {created && <Alert tone="success" className="mb-4">Resource created.</Alert>}
      <Card><CardBody className="p-5 sm:p-8">
        <ActionForm action={saveResourceAction} className="space-y-5">
          {r && <input type="hidden" name="id" value={r.id} />}
          <div className="grid gap-4 md:grid-cols-2">
            <F name="title" label="Title" className="md:col-span-2"><Input id="title" name="title" defaultValue={r?.title} /></F>
            <F name="slug" label="Slug"><Input id="slug" name="slug" defaultValue={r?.slug} placeholder="auto from title" /></F>
            <F name="type" label="Type"><Select id="type" name="type" defaultValue={r?.type ?? "article"}>{CONTENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></F>
            <F name="categoryId" label="Category"><Select id="categoryId" name="categoryId" defaultValue={r?.categoryId ?? ""}><option value="">None</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></F>
            <F name="authorName" label="Author"><Input id="authorName" name="authorName" defaultValue={r?.authorName ?? ""} /></F>
            <F name="description" label="Description" className="md:col-span-2"><Input id="description" name="description" defaultValue={r?.description ?? ""} maxLength={500} /></F>
            <F name="body" label="Body (Markdown — raw HTML is not rendered)" className="md:col-span-2"><Textarea id="body" name="body" defaultValue={r?.body} className="min-h-72 font-mono text-sm" /></F>
            <F name="externalUrl" label="External link / video / download URL"><Input id="externalUrl" name="externalUrl" type="url" defaultValue={r?.externalUrl ?? ""} /></F>
            <F name="featuredImageUrl" label="Featured image URL"><Input id="featuredImageUrl" name="featuredImageUrl" type="url" defaultValue={r?.featuredImageUrl ?? ""} /></F>
            <F name="tags" label="Tags (comma separated)"><Input id="tags" name="tags" defaultValue={res?.tags.map((t) => t.name).join(", ")} /></F>
            <F name="publishedAt" label="Publication date"><Input id="publishedAt" name="publishedAt" type="datetime-local" defaultValue={r?.publishedAt ? new Date(r.publishedAt.getTime() + 3_600_000).toISOString().slice(0, 16) : ""} /></F>
            <F name="status" label="Status"><Select id="status" name="status" defaultValue={r?.status ?? "draft"}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></Select></F>
            <F name="visibility" label="Visibility"><Select id="visibility" name="visibility" defaultValue={r?.visibility ?? "public"}><option value="public">Public</option><option value="applicants">Signed-in applicants only</option></Select></F>
            <F name="seoTitle" label="SEO title"><Input id="seoTitle" name="seoTitle" defaultValue={r?.seoTitle ?? ""} /></F>
            <F name="seoDescription" label="SEO description"><Input id="seoDescription" name="seoDescription" defaultValue={r?.seoDescription ?? ""} maxLength={320} /></F>
          </div>
          <SubmitButton size="lg">{isNew ? "Create resource" : "Save"}</SubmitButton>
        </ActionForm>
      </CardBody></Card>
    </>
  );
}
