import { ScholarshipForm } from "@/components/admin/scholarship-form";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requirePermissionPage } from "@/lib/auth/session";

export const metadata = { title: "New scholarship" };

export default async function NewScholarship() {
  await requirePermissionPage("scholarships.manage");
  return (
    <>
      <PageHeader back={{ href: "/admin/scholarships", label: "Scholarships" }} title="New scholarship" description="Create a draft from the official partner university page. You'll add the source, criteria and documents next, then verify and publish." />
      <Card><CardBody className="p-5 sm:p-8"><ScholarshipForm /></CardBody></Card>
    </>
  );
}
