import { redirect } from "next/navigation";
import { rolePermissionAction } from "@/app/actions/admin";
import { ActionButton } from "@/components/forms/action-form";
import { PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { requirePermissionPage } from "@/lib/auth/session";
import { rolePermissionMatrix } from "@/lib/services/admin";

export const metadata = { title: "Role permissions" };
export const dynamic = "force-dynamic";

const ROLES: Role[] = ["applicant", "reviewer", "admin", "super_admin"];

export default async function RolesPage() {
  const me = await requirePermissionPage("roles.manage");
  if (!me.roles.includes("super_admin")) redirect("/forbidden");
  const { rows, all } = await rolePermissionMatrix();
  const has = (r: Role, p: string) => rows.some((x) => x.role === r && x.permission === p);
  return (
    <>
      <PageHeader back={{ href: "/admin/users", label: "Users" }} title="Role permissions" description="Changes take effect on each user's next request. Every change is audited." />
      <Table caption="Permission matrix">
        <thead><tr><Th>Permission</Th>{ROLES.map((r) => <Th key={r}>{ROLE_LABELS[r]}</Th>)}</tr></thead>
        <tbody>{all.map(([perm, desc]) => (
          <tr key={perm}>
            <Td><code className="text-xs">{perm}</code><p className="text-xs text-muted">{desc}</p></Td>
            {ROLES.map((r) => (
              <Td key={r}>
                {r === "super_admin" ? <span aria-label="Always granted">✓</span> : r === "applicant" && perm !== "portal.access" ? <span className="text-muted">—</span> : (
                  <ActionButton action={rolePermissionAction} fields={{ role: r, permission: perm, grant: has(r, perm) ? "0" : "1" }} size="sm" variant={has(r, perm) ? "secondary" : "ghost"} aria-label={`${has(r, perm) ? "Revoke" : "Grant"} ${perm} for ${r}`}>{has(r, perm) ? "✓ Granted" : "Grant"}</ActionButton>
                )}
              </Td>
            ))}
          </tr>
        ))}</tbody>
      </Table>
    </>
  );
}
