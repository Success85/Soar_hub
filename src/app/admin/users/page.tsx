import Link from "next/link";
import { userRoleAction, userStatusAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Badge, PageHeader, Pagination, Table, Td, Th } from "@/components/ui/misc";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { requirePermissionPage } from "@/lib/auth/session";
import { listUsers } from "@/lib/services/admin";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Users & roles" };
export const dynamic = "force-dynamic";

const ROLES: Role[] = ["applicant", "reviewer", "admin", "super_admin"];

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; page?: string }> }) {
  const me = await requirePermissionPage("users.manage");
  const sp = await searchParams;
  const res = await listUsers({ q: sp.q, role: sp.role, page: Number(sp.page ?? 1) || 1 });
  const canRoles = me.permissions.has("roles.manage");
  return (
    <>
      <PageHeader title="Users & roles" description="Grant reviewer or administrator access. Role changes are audited; only super administrators can grant super administrator." actions={me.roles.includes("super_admin") && <Button asChild variant="secondary"><Link href="/admin/users/roles">Role permissions</Link></Button>} />
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={sp.q} placeholder="Name, email or member ID" aria-label="Search" className="w-64" />
        <Select name="role" defaultValue={sp.role ?? ""} aria-label="Role" className="w-48"><option value="">Any role</option>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</Select>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      <Table caption="Users">
        <thead><tr><Th>User</Th><Th>Joined</Th><Th>Status</Th><Th>Roles</Th><Th>Actions</Th></tr></thead>
        <tbody>{res.rows.map(({ u, roles }) => (
          <tr key={u.id}>
            <Td><p className="font-semibold">{u.firstName} {u.lastName}</p><p className="text-xs text-muted">{u.email}</p>{u.memberCode && <p className="font-mono text-xs text-muted">{u.memberCode}</p>}</Td>
            <Td className="whitespace-nowrap">{formatDate(u.createdAt)}</Td>
            <Td><Badge tone={u.status === "active" ? "success" : "danger"}>{u.status}</Badge></Td>
            <Td><div className="flex flex-wrap gap-1">{roles.map((r) => <Badge key={r} tone="info">{ROLE_LABELS[r as Role]}</Badge>)}</div></Td>
            <Td>
              <div className="flex flex-wrap gap-1">
                {canRoles && ROLES.filter((r) => r !== "super_admin" || me.roles.includes("super_admin")).map((r) => (
                  <ActionButton key={r} action={userRoleAction} fields={{ userId: u.id, role: r, grant: roles.includes(r) ? "0" : "1" }} size="sm" variant="ghost">{roles.includes(r) ? `− ${ROLE_LABELS[r]}` : `+ ${ROLE_LABELS[r]}`}</ActionButton>
                ))}
                {u.id !== me.id && (u.status === "active" ? <ActionButton action={userStatusAction} fields={{ userId: u.id, status: "suspended" }} size="sm" variant="ghost" className="text-danger-700" confirm="Suspend this account? They will be signed out immediately.">Suspend</ActionButton> : u.status === "suspended" && <ActionButton action={userStatusAction} fields={{ userId: u.id, status: "active" }} size="sm" variant="ghost">Reactivate</ActionButton>)}
              </div>
            </Td>
          </tr>
        ))}</tbody>
      </Table>
      <Pagination page={res.page} total={res.total} pageSize={25} hrefFor={(p) => `/admin/users?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.role ? { role: sp.role } : {}), page: String(p) })}`} />
    </>
  );
}
