import type { Metadata } from "next";
import { ResourceLibrary } from "@/components/resource-library";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Learning resources" };

export default async function LearnPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser();
  return (
    <>
      <PageHeader title="Learning resources" description="Guides, articles and videos to strengthen every part of your application — including members-only resources." />
      <ResourceLibrary searchParams={await searchParams} basePath="/learn" includeApplicantOnly />
    </>
  );
}
