import type { Metadata } from "next";
import { EssayEditor } from "@/components/essay-editor";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { listApplicationsForUser } from "@/lib/services/applications";

export const metadata: Metadata = { title: "New essay" };

export default async function NewEssayPage({ searchParams }: { searchParams: Promise<{ application?: string }> }) {
  const user = await requireUser();
  const { application } = await searchParams;
  const apps = await listApplicationsForUser(user.id);
  return (
    <>
      <PageHeader back={{ href: "/essays", label: "Essays" }} title="New essay" />
      <Card><CardBody className="p-5 sm:p-8"><EssayEditor applications={apps.map((a) => ({ id: a.app.id, name: a.sch.name }))} defaultApplicationId={application} /></CardBody></Card>
    </>
  );
}
