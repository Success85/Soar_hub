import "server-only";
import { and, eq } from "drizzle-orm";
import type { CurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { applications, reviewerAssignments } from "@/lib/db/schema";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export type ApplicationAccess = "owner" | "admin" | "reviewer";

export async function isAssignedReviewer(reviewerId: string, applicationId: string): Promise<boolean> {
  const rows = await db
    .select({ id: reviewerAssignments.id })
    .from(reviewerAssignments)
    .where(and(eq(reviewerAssignments.applicationId, applicationId), eq(reviewerAssignments.reviewerId, reviewerId), eq(reviewerAssignments.isActive, true)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Central authorisation for anything hanging off an application.
 * - owner: the applicant
 * - admin: holds the given admin permission
 * - reviewer: actively assigned to this application
 */
export async function applicationAccess(user: CurrentUser, applicationId: string, adminPermission: Parameters<typeof can>[1] = "applicants.view"): Promise<{ app: typeof applications.$inferSelect; access: ApplicationAccess }> {
  const [app] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
  if (!app || app.deletedAt) throw new NotFoundError("Application");
  if (app.userId === user.id) return { app, access: "owner" };
  if (can(user.permissions, adminPermission)) return { app, access: "admin" };
  if (can(user.permissions, "reviewer.access") && (await isAssignedReviewer(user.id, applicationId))) return { app, access: "reviewer" };
  // do not reveal existence to unrelated users
  throw new NotFoundError("Application");
}

export function assertOwner(user: CurrentUser, ownerId: string) {
  if (user.id !== ownerId) throw new ForbiddenError();
}
