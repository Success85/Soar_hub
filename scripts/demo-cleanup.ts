/**
 * Removes the old "[Demo] Partner University …" placeholder scholarships and everything attached to them
 * (applications, plans, eligibility results, referee requests and their upload records, notifications that mention them).
 * Uploaded documents are kept (only unlinked) because document versions are immutable, and the audit log is
 * append-only, so its history of these records stays.
 */
import { eq, inArray, like, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { applications, eligibilityAssessments, notifications, refereeRequests, refereeUploads, scholarships } from "@/lib/db/schema";

export async function removeDemoScholarships(): Promise<number> {
  const demos = await db.select({ id: scholarships.id }).from(scholarships).where(eq(scholarships.isDemo, true));
  if (!demos.length) return 0;
  const ids = demos.map((d) => d.id);
  await db.transaction(async (tx) => {
    const apps = await tx.select({ id: applications.id }).from(applications).where(inArray(applications.scholarshipId, ids));
    const appIds = apps.map((a) => a.id);
    if (appIds.length) {
      const reqs = await tx.select({ id: refereeRequests.id }).from(refereeRequests).where(inArray(refereeRequests.applicationId, appIds));
      if (reqs.length) await tx.delete(refereeUploads).where(inArray(refereeUploads.requestId, reqs.map((r) => r.id)));
      await tx.delete(refereeRequests).where(inArray(refereeRequests.applicationId, appIds));
      await tx.delete(applications).where(inArray(applications.id, appIds));
    }
    await tx.delete(eligibilityAssessments).where(inArray(eligibilityAssessments.scholarshipId, ids));
    await tx.delete(notifications).where(or(like(notifications.subject, "%[Demo]%"), like(notifications.body, "%[Demo]%")));
    await tx.delete(scholarships).where(inArray(scholarships.id, ids));
  });
  return ids.length;
}
