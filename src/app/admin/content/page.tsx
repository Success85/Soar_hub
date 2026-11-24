import Link from "next/link";
import { saveCategoryAction } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { Badge, PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { requirePermissionPage } from "@/lib/auth/session";
import { CONTENT_TYPES, listCategories, listContactMessages, listResources } from "@/lib/services/content";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Content" };
export const dynamic = "force-dynamic";

export default async function AdminContent({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; type?: string }> }) {
  await requirePermissionPage("content.manage");
  const sp = await searchParams;
  const [rows, cats, messages] = await Promise.all([listResources({ admin: true, q: sp.q, status: sp.status, type: sp.type, limit: 200 }), listCategories(), listContactMessages()]);
  return (
    <>
      <PageHeader title="Content & learning resources" description="Guides, articles, FAQs, videos, downloads, webinars and announcements. Published items appear in the public library." actions={<Button asChild><Link href="/admin/content/new">New resource</Link></Button>} />
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={sp.q} placeholder="Search" aria-label="Search" className="w-64" />
        <Select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="w-40"><option value="">Any status</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></Select>
        <Select name="type" defaultValue={sp.type ?? ""} aria-label="Type" className="w-48"><option value="">Any type</option>{CONTENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      <Table caption="Resources">
        <thead><tr><Th>Title</Th><Th>Type</Th><Th>Category</Th><Th>Status</Th><Th>Visibility</Th><Th>Published</Th></tr></thead>
        <tbody>{rows.map(({ r, category }) => (
          <tr key={r.id}>
            <Td><Link href={`/admin/content/${r.id}`} className="font-semibold hover:underline">{r.title}</Link>{r.isDemo && <Badge className="ml-2">Demo</Badge>}</Td>
            <Td>{CONTENT_TYPES.find((t) => t.value === r.type)?.label}</Td>
            <Td>{category?.name ?? "—"}</Td>
            <Td><Badge tone={r.status === "published" ? "success" : r.status === "draft" ? "warning" : "neutral"}>{r.status}</Badge></Td>
            <Td>{r.visibility === "public" ? "Public" : "Members only"}</Td>
            <Td>{formatDate(r.publishedAt)}</Td>
          </tr>
        ))}{rows.length === 0 && <tr><Td colSpan={6} className="py-8 text-center text-muted">No resources.</Td></tr>}</tbody>
      </Table>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Categories</CardTitle></CardHeader>
          <CardBody>
            <ul className="mb-4 flex flex-wrap gap-2">{cats.map((c) => <li key={c.id}><Badge>{c.name}</Badge></li>)}</ul>
            <ActionForm action={saveCategoryAction} className="flex flex-wrap gap-2" resetOnSuccess><Input name="name" placeholder="New category" aria-label="Category name" className="w-56" /><Input name="description" placeholder="Description" aria-label="Category description" className="w-64" /><SubmitButton variant="secondary">Add</SubmitButton></ActionForm>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Contact form messages</CardTitle></CardHeader>
          <CardBody>
            <ul className="max-h-96 space-y-3 overflow-y-auto text-sm">{messages.map((m) => <li key={m.id} className="rounded-lg border border-line p-3"><p className="font-semibold">{m.subject}</p><p className="text-xs text-muted">{m.name} · <a className="underline" href={`mailto:${m.email}`}>{m.email}</a> · {formatDateTime(m.createdAt)}</p><p className="mt-1 whitespace-pre-wrap">{m.message}</p></li>)}{messages.length === 0 && <li className="text-muted">No messages.</li>}</ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
