import "server-only";
import { and, asc, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { applicationMilestones, applications, documentComments, documents, documentVersions, essayFeedback, essays, notifications, refereeRequests, scholarships } from "@/lib/db/schema";
import { dayInTimezone, effectiveStatus } from "@/lib/engine/scheduler";
import { listResources } from "./content";
import { screenPublished } from "./eligibility";
import { getProfileBundle } from "./profile";
import { savedFor } from "./scholarships";

/** Applicant dashboard — every figure is computed from the applicant's own records. */
export async function applicantDashboard(userId: string) {
  const today = dayInTimezone(new Date(), "Africa/Lagos");
  const [bundle, apps, saved, screening, unread, resources] = await Promise.all([
    getProfileBundle(userId),
    db
      .select({ a: applications, s: { name: scholarships.name, slug: scholarships.slug, deadline: scholarships.deadline } })
      .from(applications)
      .innerJoin(scholarships, eq(scholarships.id, applications.scholarshipId))
      .where(and(eq(applications.userId, userId), isNull(applications.deletedAt)))
      .orderBy(desc(applications.updatedAt)),
    savedFor(userId),
    screenPublished(userId),
    db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.channel, "in_app"), isNull(notifications.readAt))),
    listResources({ includeApplicantOnly: true, limit: 3 }),
  ]);
  const activeIds = apps.filter((a) => !["outcome", "ineligible"].includes(a.a.status)).map((a) => a.a.id);
  const milestones = activeIds.length
    ? await db
        .select({ m: applicationMilestones, scholarshipName: scholarships.name })
        .from(applicationMilestones)
        .innerJoin(applications, eq(applications.id, applicationMilestones.applicationId))
        .innerJoin(scholarships, eq(scholarships.id, applications.scholarshipId))
        .where(and(inArray(applicationMilestones.applicationId, activeIds), notInArray(applicationMilestones.status, ["completed"])))
        .orderBy(asc(applicationMilestones.dueDate))
    : [];
  const withStatus = milestones.map((r) => ({ ...r, effective: effectiveStatus(r.m, today) }));
  const overdue = withStatus.filter((r) => r.effective === "overdue");
  const upcoming = withStatus.filter((r) => r.effective !== "overdue").slice(0, 6);

  const docFeedback = await db
    .select({ id: documentComments.id, body: documentComments.body, createdAt: documentComments.createdAt, documentId: documents.id, title: documents.title })
    .from(documentComments)
    .innerJoin(documentVersions, eq(documentVersions.id, documentComments.documentVersionId))
    .innerJoin(documents, eq(documents.id, documentVersions.documentId))
    .where(and(eq(documents.userId, userId), eq(documentComments.status, "outstanding")))
    .orderBy(desc(documentComments.createdAt))
    .limit(5);
  const essayFb = await db
    .select({ id: essayFeedback.id, body: essayFeedback.body, createdAt: essayFeedback.publishedAt, essayId: essays.id, title: essays.title, source: essayFeedback.source })
    .from(essayFeedback)
    .innerJoin(essays, eq(essays.id, essayFeedback.essayId))
    .where(and(eq(essays.userId, userId), eq(essayFeedback.status, "outstanding")))
    .orderBy(desc(essayFeedback.publishedAt))
    .limit(5);
  const feedback = [
    ...docFeedback.map((d) => ({ kind: "document" as const, id: d.id, title: d.title, body: d.body, at: d.createdAt, href: `/documents/${d.documentId}` })),
    ...essayFb.map((e) => ({ kind: "essay" as const, id: e.id, title: e.title, body: e.body ?? (e.source === "ai_approved" ? "Approved structured critique" : ""), at: e.createdAt, href: `/essays/${e.essayId}` })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 5);

  const referees = await db
    .select({ r: refereeRequests, scholarshipName: scholarships.name })
    .from(refereeRequests)
    .innerJoin(applications, eq(applications.id, refereeRequests.applicationId))
    .innerJoin(scholarships, eq(scholarships.id, applications.scholarshipId))
    .where(and(eq(refereeRequests.applicantId, userId), inArray(refereeRequests.status, ["sent", "opened"])))
    .orderBy(asc(refereeRequests.tokenExpiresAt));

  const recentNotifications = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.channel, "in_app")))
    .orderBy(desc(notifications.createdAt))
    .limit(5);

  return {
    ...bundle,
    apps,
    saved,
    recommended: screening.filter((s) => s.verdict !== "not_eligible" && (s.scholarship.windowStatus === "open" || s.scholarship.windowStatus === "opens_soon")).slice(0, 3),
    screening,
    overdue,
    upcoming,
    feedback,
    referees,
    unread: unread[0]?.count ?? 0,
    recentNotifications,
    resources,
    today,
  };
}
