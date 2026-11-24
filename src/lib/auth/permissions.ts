export type Role = "applicant" | "reviewer" | "admin" | "super_admin";

export const PERMISSIONS = {
  "portal.access": "Use the applicant portal",
  "reviewer.access": "Open the reviewer workspace",
  "admin.access": "Open the admin dashboard",
  "scholarships.manage": "Create and edit scholarships, criteria, documents and milestones",
  "scholarships.publish": "Verify sources and publish/unpublish scholarships",
  "applicants.view": "View applicant records (non-sensitive)",
  "applicants.view_sensitive": "View sensitive applicant fields (income, disability, refugee status, gender, date of birth)",
  "applications.manage": "Manage application status and outcomes",
  "reviewers.assign": "Assign reviewers to applications",
  "reviews.documents": "Review documents (all applications)",
  "reviews.essays": "Review essays (all applications)",
  "ai.generate": "Generate AI essay critiques",
  "ai.approve": "Approve, edit or reject AI critiques (all applications)",
  "referees.manage": "View and revoke referee requests",
  "notifications.manage": "Monitor, retry and cancel notifications",
  "templates.manage": "Edit notification templates",
  "content.manage": "Manage learning resources and CMS content",
  "analytics.view": "View analytics and reports",
  "exports.basic": "Export non-sensitive CSV reports",
  "exports.sensitive": "Include sensitive fields in exports",
  "users.manage": "Manage user accounts",
  "roles.manage": "Assign roles and edit role permissions",
  "audit.view": "View audit logs",
  "settings.manage": "Change platform settings",
  "data_requests.manage": "Process data export and account deletion requests",
} as const;

export type Permission = keyof typeof PERMISSIONS;

const ADMIN: Permission[] = [
  "admin.access", "reviewer.access", "scholarships.manage", "scholarships.publish", "applicants.view", "applications.manage",
  "reviewers.assign", "reviews.documents", "reviews.essays", "ai.generate", "ai.approve", "referees.manage", "notifications.manage",
  "templates.manage", "content.manage", "analytics.view", "exports.basic", "users.manage", "roles.manage", "audit.view",
  "settings.manage", "data_requests.manage",
];

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  applicant: ["portal.access"],
  reviewer: ["reviewer.access"],
  admin: ADMIN,
  super_admin: Object.keys(PERMISSIONS) as Permission[],
};

export const ROLE_LABELS: Record<Role, string> = {
  applicant: "Applicant",
  reviewer: "Reviewer / Coach",
  admin: "Administrator",
  super_admin: "Super administrator",
};

/** Pure check over an already-resolved permission set. */
export function can(perms: Iterable<string>, permission: Permission): boolean {
  for (const p of perms) if (p === permission) return true;
  return false;
}

/** Fields considered sensitive (NDPR data minimisation). */
export const SENSITIVE_PROFILE_FIELDS = ["dateOfBirth", "gender", "householdIncomeBand", "demonstratesFinancialNeed", "hasDisability", "isRefugeeOrDisplaced", "phone"] as const;

export function redactProfile<T extends Record<string, unknown>>(profile: T, canSeeSensitive: boolean): T {
  if (canSeeSensitive) return profile;
  const copy: Record<string, unknown> = { ...profile };
  for (const f of SENSITIVE_PROFILE_FIELDS) if (f in copy && copy[f] !== null && copy[f] !== undefined) copy[f] = "[restricted]";
  return copy as T;
}
