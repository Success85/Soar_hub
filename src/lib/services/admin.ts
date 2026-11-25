import "server-only";
import { normaliseMemberCode } from "@/lib/member-code";
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import type { CurrentUser } from "@/lib/auth/session";
import { can, PERMISSIONS, type Permission, type Role } from "@/lib/auth/permissions";
import { revokeAllSessions } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  aiCritiqueApprovals,
  applicationMilestones,
  applications,
  auditLogs,
  documents,
  eligibilityAssessments,
  notifications,
  profiles,
  refereeRequests,
  reviewerAssignments,
  rolePermissions,
  scholarships,
  userRoles,
  users,
} from "@/lib/db/schema";
import { idempotencyKey } from "@/lib/engine/notification-keys";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { audit } from "./audit";
import { enqueueNotification } from "./notifications";

/* ------------------------------------------------------------------ */
/* Overview statistics (all computed live from the database)           */
/* ------------------------------------------------------------------ */

export async function overviewStats() {
  const [row] = await db.execute<Record<string, number>>(sql`
    SELECT
      (SELECT count(*)::int FROM users u WHERE EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'applicant') AND u.deleted_at IS NULL) AS total_applicants,
      (SELECT count(*)::int FROM users u WHERE u.email_verified_at IS NOT NULL AND u.deleted_at IS NULL) AS verified_users,
      (SELECT count(DISTINCT user_id)::int FROM user_activity WHERE created_at > now() - interval '30 days' AND user_id IS NOT NULL) AS active_applicants,
      (SELECT count(*)::int FROM applications WHERE deleted_at IS NULL) AS applications_created,
      (SELECT count(*)::int FROM applications WHERE deleted_at IS NULL AND status IN ('eligible','in_progress')) AS applications_in_progress,
      (SELECT count(*)::int FROM applications WHERE deleted_at IS NULL AND status = 'submitted') AS applications_submitted,
      (SELECT count(*)::int FROM applications WHERE deleted_at IS NULL AND status = 'shortlisted') AS applications_shortlisted,
      (SELECT count(*)::int FROM applications WHERE deleted_at IS NULL AND status = 'outcome') AS outcomes_recorded,
      (SELECT count(*)::int FROM scholarships) AS scholarships_total,
      (SELECT count(*)::int FROM scholarships WHERE status = 'published' AND is_active) AS scholarships_active,
      (SELECT count(*)::int FROM scholarships WHERE status IN ('draft','pending_verification')) AS scholarships_pending_verification,
      (SELECT count(*)::int FROM scholarships WHERE status = 'published' AND deadline BETWEEN now() AND now() + interval '30 days') AS upcoming_deadlines,
      (SELECT count(*)::int FROM application_milestones m JOIN applications a ON a.id = m.application_id WHERE m.status <> 'completed' AND m.due_date < current_date AND a.status IN ('eligible','in_progress') AND a.deleted_at IS NULL) AS overdue_milestones,
      (SELECT count(*)::int FROM application_documents WHERE deleted_at IS NULL AND review_status IN ('pending_review','under_review')) AS pending_document_reviews,
      (SELECT count(*)::int FROM ai_critique_approvals WHERE decision IN ('pending','needs_more_review')) AS pending_ai_approvals,
      (SELECT count(*)::int FROM essays WHERE deleted_at IS NULL AND status IN ('ai_review_pending','human_review_pending')) AS pending_essay_reviews,
      (SELECT count(*)::int FROM referee_requests WHERE status IN ('sent','opened')) AS pending_referee_requests,
      (SELECT count(*)::int FROM notifications WHERE status = 'failed') AS failed_notifications,
      (SELECT count(*)::int FROM data_requests WHERE status = 'pending') AS pending_data_requests
  `);
  return row;
}

export async function statusDistribution() {
  const rows = await db.execute<{ status: string; count: number }>(sql`SELECT status::text, count(*)::int AS count FROM applications WHERE deleted_at IS NULL GROUP BY status ORDER BY status`);
  return [...rows];
}

export async function registrationsSeries(days = 30) {
  const rows = await db.execute<{ day: string; count: number }>(sql`
    SELECT to_char(d::date, 'YYYY-MM-DD') AS day, coalesce(c.count, 0)::int AS count
    FROM generate_series(current_date - (${days - 1}::int), current_date, interval '1 day') d
    LEFT JOIN (SELECT created_at::date AS day, count(*) AS count FROM users WHERE deleted_at IS NULL GROUP BY 1) c ON c.day = d::date
    ORDER BY d`);
  return [...rows];
}

/* ------------------------------------------------------------------ */
/* Applicants                                                          */
/* ------------------------------------------------------------------ */

export interface ApplicantFilters {
  q?: string;
  from?: string;
  to?: string;
  scholarshipId?: string;
  status?: string;
  verdict?: string;
  reviewerId?: string;
  completion?: "low" | "mid" | "high";
  deadlineBefore?: string;
  page?: number;
}

const completionSql = sql<number>`(
  (CASE WHEN p.date_of_birth IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN p.country_of_citizenship IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN p.country_of_residence IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN p.state_of_origin IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN p.phone IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN p.education_level IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN p.current_school IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN p.graduation_year IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN coalesce(array_length(p.qualifications,1),0) > 0 THEN 1 ELSE 0 END) + (CASE WHEN p.credit_passes IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN p.first_generation IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN p.employment_status IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN p.preferred_programme IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN p.career_interests IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN p.personal_background IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN EXISTS (SELECT 1 FROM consents c WHERE c.user_id = u.id AND c.type = 'data_processing' AND c.revoked_at IS NULL) THEN 1 ELSE 0 END)
) * 100 / 16`;

export async function listApplicants(f: ApplicantFilters, opts: { limit?: number } = {}) {
  const conds: SQL[] = [sql`EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'applicant')`, sql`u.deleted_at IS NULL`];
  if (f.q) {
    const code = normaliseMemberCode(f.q);
    conds.push(code ? sql`u.member_code = ${code}` : sql`(u.first_name || ' ' || u.last_name ILIKE ${"%" + f.q + "%"} OR u.email ILIKE ${"%" + f.q + "%"} OR u.member_code ILIKE ${"%" + f.q.trim() + "%"})`);
  }
  if (f.from) conds.push(sql`u.created_at >= ${f.from}::date`);
  if (f.to) conds.push(sql`u.created_at < (${f.to}::date + 1)`);
  if (f.scholarshipId) conds.push(sql`EXISTS (SELECT 1 FROM applications a WHERE a.user_id = u.id AND a.scholarship_id = ${f.scholarshipId} AND a.deleted_at IS NULL)`);
  if (f.status) conds.push(sql`EXISTS (SELECT 1 FROM applications a WHERE a.user_id = u.id AND a.status::text = ${f.status} AND a.deleted_at IS NULL)`);
  if (f.verdict) conds.push(sql`EXISTS (SELECT 1 FROM eligibility_assessments ea WHERE ea.user_id = u.id AND ea.is_current AND ea.overall_verdict::text = ${f.verdict})`);
  if (f.reviewerId) conds.push(sql`EXISTS (SELECT 1 FROM applications a JOIN reviewer_assignments ra ON ra.application_id = a.id AND ra.is_active WHERE a.user_id = u.id AND ra.reviewer_id = ${f.reviewerId})`);
  if (f.deadlineBefore) conds.push(sql`EXISTS (SELECT 1 FROM applications a WHERE a.user_id = u.id AND a.deadline <= (${f.deadlineBefore}::date + 1) AND a.deleted_at IS NULL)`);
  if (f.completion === "low") conds.push(sql`${completionSql} < 40`);
  if (f.completion === "mid") conds.push(sql`${completionSql} BETWEEN 40 AND 79`);
  if (f.completion === "high") conds.push(sql`${completionSql} >= 80`);
  const where = sql.join(conds, sql` AND `);
  const limit = opts.limit ?? 25;
  const page = Math.max(1, f.page ?? 1);
  const rows = await db.execute<{
    id: string; first_name: string; last_name: string; email: string; created_at: string; email_verified_at: string | null; status: string;
    member_code: string | null; completion: number; applications: number; latest_status: string | null; submitted: number; state_of_origin: string | null; education_level: string | null;
  }>(sql`
    SELECT u.id, u.first_name, u.last_name, u.email, u.member_code, u.created_at, u.email_verified_at, u.status::text,
      ${completionSql} AS completion,
      (SELECT count(*)::int FROM applications a WHERE a.user_id = u.id AND a.deleted_at IS NULL) AS applications,
      (SELECT a.status::text FROM applications a WHERE a.user_id = u.id AND a.deleted_at IS NULL ORDER BY a.updated_at DESC LIMIT 1) AS latest_status,
      (SELECT count(*)::int FROM applications a WHERE a.user_id = u.id AND a.submitted_at IS NOT NULL) AS submitted,
      p.state_of_origin, p.education_level::text
    FROM users u LEFT JOIN profiles p ON p.user_id = u.id
    WHERE ${where}
    ORDER BY u.created_at DESC
    LIMIT ${limit} OFFSET ${(page - 1) * limit}`);
  const [{ count }] = await db.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE ${where}`);
  return { rows: [...rows], total: count, page, pageSize: limit };
}

export async function applicantDetail(userId: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) throw new NotFoundError("Applicant");
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const apps = await db
    .select({ a: applications, s: { name: scholarships.name, id: scholarships.id } })
    .from(applications)
    .innerJoin(scholarships, eq(scholarships.id, applications.scholarshipId))
    .where(and(eq(applications.userId, userId), isNull(applications.deletedAt)))
    .orderBy(desc(applications.updatedAt));
  const appIds = apps.map((a) => a.a.id);
  const [assessments, assignments, milestones, docs, referees, notifs] = await Promise.all([
    db.select({ e: eligibilityAssessments, name: scholarships.name }).from(eligibilityAssessments).innerJoin(scholarships, eq(scholarships.id, eligibilityAssessments.scholarshipId)).where(eq(eligibilityAssessments.userId, userId)).orderBy(desc(eligibilityAssessments.createdAt)).limit(30),
    appIds.length
      ? db.select({ ra: reviewerAssignments, reviewer: { id: users.id, firstName: users.firstName, lastName: users.lastName } }).from(reviewerAssignments).innerJoin(users, eq(users.id, reviewerAssignments.reviewerId)).where(and(inArray(reviewerAssignments.applicationId, appIds), eq(reviewerAssignments.isActive, true)))
      : Promise.resolve([]),
    appIds.length ? db.select().from(applicationMilestones).where(inArray(applicationMilestones.applicationId, appIds)).orderBy(asc(applicationMilestones.dueDate)) : Promise.resolve([]),
    db.select().from(documents).where(and(eq(documents.userId, userId), isNull(documents.deletedAt))).orderBy(desc(documents.updatedAt)),
    db.select().from(refereeRequests).where(eq(refereeRequests.applicantId, userId)).orderBy(desc(refereeRequests.createdAt)),
    db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(50),
  ]);
  return { user: u, profile: profile ?? null, apps, assessments, assignments, milestones, docs, referees, notifications: notifs };
}

/* ------------------------------------------------------------------ */
/* Applications (admin view)                                           */
/* ------------------------------------------------------------------ */

export async function adminListApplications(f: { q?: string; status?: string; scholarshipId?: string; unassigned?: boolean; page?: number }) {
  const conds: SQL[] = [isNull(applications.deletedAt)];
  if (f.status) conds.push(eq(applications.status, f.status as never));
  if (f.scholarshipId) conds.push(eq(applications.scholarshipId, f.scholarshipId));
  if (f.q) conds.push(or(ilike(users.firstName, `%${f.q}%`), ilike(users.lastName, `%${f.q}%`), ilike(users.email, `%${f.q}%`), eq(users.memberCode, normaliseMemberCode(f.q) ?? "-"))!);
  if (f.unassigned) conds.push(sql`NOT EXISTS (SELECT 1 FROM reviewer_assignments ra WHERE ra.application_id = ${applications.id} AND ra.is_active)`);
  const page = Math.max(1, f.page ?? 1);
  const where = and(...conds);
  const rows = await db
    .select({
      a: applications,
      s: { name: scholarships.name },
      u: { id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email },
      reviewers: sql<string | null>`(SELECT string_agg(ru.first_name || ' ' || ru.last_name, ', ') FROM reviewer_assignments ra JOIN users ru ON ru.id = ra.reviewer_id WHERE ra.application_id = ${applications.id} AND ra.is_active)`,
    })
    .from(applications)
    .innerJoin(users, eq(users.id, applications.userId))
    .innerJoin(scholarships, eq(scholarships.id, applications.scholarshipId))
    .where(where)
    .orderBy(desc(applications.updatedAt))
    .limit(25)
    .offset((page - 1) * 25);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(applications).innerJoin(users, eq(users.id, applications.userId)).where(where);
  return { rows, total: count, page };
}

/* ------------------------------------------------------------------ */
/* Reviewer assignment                                                 */
/* ------------------------------------------------------------------ */

export async function listReviewers() {
  return db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email, active: sql<number>`(SELECT count(*)::int FROM reviewer_assignments ra WHERE ra.reviewer_id = ${users.id} AND ra.is_active)` })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .where(and(eq(userRoles.role, "reviewer"), eq(users.status, "active")))
    .orderBy(asc(users.firstName));
}

export async function assignReviewer(actor: CurrentUser, applicationId: string, reviewerId: string) {
  if (!can(actor.permissions, "reviewers.assign")) throw new ForbiddenError();
  const [isReviewer] = await db.select().from(userRoles).where(and(eq(userRoles.userId, reviewerId), eq(userRoles.role, "reviewer"))).limit(1);
  if (!isReviewer) throw new AppError("That user isn't a reviewer.", 400);
  const [app] = await db.select({ a: applications, s: scholarships, u: users }).from(applications).innerJoin(scholarships, eq(scholarships.id, applications.scholarshipId)).innerJoin(users, eq(users.id, applications.userId)).where(eq(applications.id, applicationId)).limit(1);
  if (!app) throw new NotFoundError("Application");
  if (app.a.userId === reviewerId) throw new AppError("Reviewers can't be assigned to their own application.", 400);
  const inserted = await db.insert(reviewerAssignments).values({ applicationId, reviewerId, assignedBy: actor.id }).onConflictDoNothing().returning();
  if (!inserted[0]) return;
  await audit({ eventType: "reviewer.assigned", actorId: actor.id, actorRole: "admin", targetType: "application", targetId: applicationId, metadata: { reviewerId } });
  const [r] = await db.select().from(users).where(eq(users.id, reviewerId)).limit(1);
  for (const channel of ["email", "in_app"] as const) {
    await enqueueNotification({ templateKey: "review.assigned", channel, userId: reviewerId, idempotencyKey: idempotencyKey(["review.assigned", inserted[0].id, channel]), vars: { firstName: r.firstName, applicantName: `${app.u.firstName} ${app.u.lastName}`, scholarshipName: app.s.name }, actionUrl: `/reviewer/applications/${applicationId}` });
  }
}

export async function unassignReviewer(actor: CurrentUser, applicationId: string, reviewerId: string) {
  if (!can(actor.permissions, "reviewers.assign")) throw new ForbiddenError();
  await db.update(reviewerAssignments).set({ isActive: false, endedAt: new Date() }).where(and(eq(reviewerAssignments.applicationId, applicationId), eq(reviewerAssignments.reviewerId, reviewerId), eq(reviewerAssignments.isActive, true)));
  await audit({ eventType: "reviewer.unassigned", actorId: actor.id, actorRole: "admin", targetType: "application", targetId: applicationId, metadata: { reviewerId } });
}

export async function assignedApplications(reviewerId: string) {
  return db
    .select({ a: applications, s: { name: scholarships.name, deadline: scholarships.deadline }, u: { firstName: users.firstName, lastName: users.lastName } })
    .from(reviewerAssignments)
    .innerJoin(applications, eq(applications.id, reviewerAssignments.applicationId))
    .innerJoin(scholarships, eq(scholarships.id, applications.scholarshipId))
    .innerJoin(users, eq(users.id, applications.userId))
    .where(and(eq(reviewerAssignments.reviewerId, reviewerId), eq(reviewerAssignments.isActive, true), isNull(applications.deletedAt)))
    .orderBy(asc(applications.deadline));
}

/* ------------------------------------------------------------------ */
/* Users & roles                                                       */
/* ------------------------------------------------------------------ */

export async function listUsers(f: { q?: string; role?: string; page?: number }) {
  const conds: SQL[] = [isNull(users.deletedAt)];
  if (f.q) conds.push(or(ilike(users.email, `%${f.q}%`), ilike(users.firstName, `%${f.q}%`), ilike(users.lastName, `%${f.q}%`), eq(users.memberCode, normaliseMemberCode(f.q) ?? "-"))!);
  if (f.role) conds.push(sql`EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = ${users.id} AND r.role::text = ${f.role})`);
  const page = Math.max(1, f.page ?? 1);
  const rows = await db
    .select({ u: users, roles: sql<string[]>`ARRAY(SELECT r.role::text FROM user_roles r WHERE r.user_id = ${users.id} ORDER BY r.role)` })
    .from(users)
    .where(and(...conds))
    .orderBy(desc(users.createdAt))
    .limit(25)
    .offset((page - 1) * 25);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(and(...conds));
  return { rows, total: count, page };
}

export async function setUserRole(actor: CurrentUser, userId: string, role: Role, grant: boolean) {
  if (!can(actor.permissions, "roles.manage")) throw new ForbiddenError();
  if (role === "super_admin" && !actor.roles.includes("super_admin")) throw new ForbiddenError("Only a super administrator can grant or remove that role.");
  if (userId === actor.id && !grant && (role === "admin" || role === "super_admin")) throw new AppError("You can't remove your own administrator role.", 400);
  if (grant) await db.insert(userRoles).values({ userId, role, grantedBy: actor.id }).onConflictDoNothing();
  else {
    if (role === "super_admin") {
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(userRoles).where(eq(userRoles.role, "super_admin"));
      if (count <= 1) throw new AppError("There must be at least one super administrator.", 400);
    }
    await db.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)));
    if (role === "reviewer") await db.update(reviewerAssignments).set({ isActive: false, endedAt: new Date() }).where(and(eq(reviewerAssignments.reviewerId, userId), eq(reviewerAssignments.isActive, true)));
  }
  await audit({ eventType: grant ? "role.granted" : "role.revoked", actorId: actor.id, actorRole: "admin", targetType: "user", targetId: userId, newState: { role } });
}

export async function setUserStatus(actor: CurrentUser, userId: string, status: "active" | "suspended") {
  if (!can(actor.permissions, "users.manage")) throw new ForbiddenError();
  if (userId === actor.id) throw new AppError("You can't change your own account status.", 400);
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw new NotFoundError("User");
  const targetRoles = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  if (targetRoles.some((r) => r.role === "super_admin") && !actor.roles.includes("super_admin")) throw new ForbiddenError();
  await db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, userId));
  if (status === "suspended") await revokeAllSessions(userId);
  await audit({ eventType: status === "suspended" ? "user.suspended" : "user.reactivated", actorId: actor.id, actorRole: "admin", targetType: "user", targetId: userId, previousState: { status: target.status }, newState: { status } });
}

export async function rolePermissionMatrix() {
  const rows = await db.select().from(rolePermissions);
  return { rows, all: Object.entries(PERMISSIONS) as [Permission, string][] };
}

export async function setRolePermission(actor: CurrentUser, role: Role, permission: Permission, grant: boolean) {
  if (!actor.roles.includes("super_admin")) throw new ForbiddenError("Only a super administrator can change role permissions.");
  if (!(permission in PERMISSIONS)) throw new AppError("Unknown permission", 400);
  if (role === "super_admin" && !grant) throw new AppError("Super administrators always hold every permission.", 400);
  if (role === "applicant" && permission !== "portal.access" && grant) throw new AppError("Applicants can't be granted staff permissions.", 400);
  if (grant) await db.insert(rolePermissions).values({ role, permission }).onConflictDoNothing();
  else await db.delete(rolePermissions).where(and(eq(rolePermissions.role, role), eq(rolePermissions.permission, permission)));
  await audit({ eventType: grant ? "permission.granted" : "permission.revoked", actorId: actor.id, actorRole: "super_admin", targetType: "role", targetId: role, newState: { permission } });
}

/* ------------------------------------------------------------------ */
/* Audit log browsing (read-only)                                      */
/* ------------------------------------------------------------------ */

export async function searchAudit(f: { q?: string; eventType?: string; actorId?: string; targetId?: string; from?: string; to?: string; page?: number }) {
  const conds: SQL[] = [];
  if (f.eventType) conds.push(ilike(auditLogs.eventType, `${f.eventType}%`));
  if (f.actorId) conds.push(eq(auditLogs.actorId, f.actorId));
  if (f.targetId) conds.push(eq(auditLogs.targetId, f.targetId));
  if (f.from) conds.push(gte(auditLogs.createdAt, new Date(f.from)));
  if (f.to) conds.push(lte(auditLogs.createdAt, new Date(new Date(f.to).getTime() + 86_400_000)));
  if (f.q) conds.push(or(ilike(auditLogs.eventType, `%${f.q}%`), ilike(auditLogs.targetType, `%${f.q}%`), ilike(auditLogs.targetId, `%${f.q}%`))!);
  const page = Math.max(1, f.page ?? 1);
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db
    .select({ log: auditLogs, actor: { firstName: users.firstName, lastName: users.lastName, email: users.email } })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(where)
    .orderBy(desc(auditLogs.id))
    .limit(50)
    .offset((page - 1) * 50);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(where);
  return { rows, total: count, page };
}

export async function pendingAiCount() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(aiCritiqueApprovals).where(inArray(aiCritiqueApprovals.decision, ["pending", "needs_more_review"]));
  return count;
}
