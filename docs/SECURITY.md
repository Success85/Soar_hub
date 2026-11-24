# Security & privacy

## Authentication & sessions
- Passwords: scrypt (N=16384, r=8, p=1, 64-byte key, random 16-byte salt); policy ≥10 chars with a letter and a
  number, no common words or the user's name/email.
- Login: generic error messages (no account enumeration), constant-ish timing for unknown emails, account lock
  for 15 minutes after 8 failures, IP- and email-scoped rate limits.
- Sessions: 256-bit random token in an `httpOnly`, `Secure`, `SameSite=Lax`, `__Host-` prefixed cookie (production);
  only its HMAC is stored. **Idle expiry 30 minutes** (sliding), absolute expiry 12 hours, revoked on logout,
  password change/reset, suspension and deletion requests.
- Email verification required for all protected features; verification (24 h) and reset (1 h) tokens are single-use,
  HMAC-stored, and their links are removed from the notification table after sending.

## Authorisation
- Roles: applicant, reviewer, admin, super_admin; permissions stored in `role_permissions` and editable only by super
  admins. Every server action and route handler re-checks permissions (`assertPermission`, `applicationAccess`,
  `documentAccess`, `essayAccess`). UI hiding is cosmetic only.
- Applicants can only read/write their own records; foreign IDs return *not found* (no existence leaks).
- Reviewers see only applications they're actively assigned to; sensitive profile fields are never shown to them.
- Sensitive fields (DOB, gender, income, disability, refugee status, phone) require `applicants.view_sensitive`
  (super admin by default) and `exports.sensitive` for CSV; viewing an applicant record is audit-logged.
- Referees: token-scoped page showing only applicant name, scholarship, instructions and deadline; single-use
  (row lock prevents double submission), 14-day expiry, revocable, rotated on reminder/resend.

## Input, output & transport
- Zod validation on every server boundary; Drizzle parameterised queries (no string-built SQL with user input).
- React escapes output; Markdown is rendered without raw HTML; email templates HTML-escape variables;
  CSV exports neutralise spreadsheet formula injection.
- CSRF: Server Actions are origin-checked by Next.js; route handlers that mutate are token- or signature-authenticated.
- Security headers: CSP, HSTS (prod), `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, COOP. CSP allows inline scripts (required by Next.js without nonces).
- Rate limits (PostgreSQL-backed): register, login, reset, verification resend, contact form, referee open/submit,
  exports.

## Files
- Private bucket only; downloads via an authorised endpoint redirecting to 120-second signed URLs; non-owner access
  audit-logged.
- Validation: size limit (admin-configurable), extension allow-list, **magic-byte sniffing**, declared MIME match.
- Malware: ClamAV INSTREAM when `CLAMAV_HOST` is set; infected files rejected; otherwise versions are visibly marked
  "not scanned".
- Versions are immutable (DB trigger) and cannot be deleted; documents are soft-deleted.

## AI
- Only essay critique; output schema-validated and safety-checked (no rewrites, no guarantees); essays are wrapped
  as data with an instruction to ignore embedded instructions; nothing reaches applicants without human approval;
  provider, model, prompt version, rubric version, reviewer and edits are recorded.

## Audit
`audit_logs` is append-only (triggers block UPDATE/DELETE/TRUNCATE for every database role). Logged events include
account creation/verification/login, profile changes (sensitive values omitted), role/permission changes,
scholarship edits/publication, eligibility assessments, state transitions, uploads, reviews, comments, AI
generation/approval, referee activity, notification failures/retries, exports, settings, privacy requests.

## Privacy (Nigeria Data Protection Act 2023 / NDPR)
- Consent captured and versioned at registration (privacy, terms) and for data processing and SMS.
- Data minimisation: sensitive questions are optional, asked last, only when a scholarship needs them.
- Self-service JSON data export and account deletion requests; admins process erasure within 30 days
  (personal data erased/anonymised; de-identified application history and audit logs retained).
- Legal text in `src/lib/legal.ts` is a template — have it reviewed by counsel before launch.

## Supabase-specific note
Migration `0002_enable_rls` enables Row Level Security on every table with **no policies**: Supabase's
`anon`/`authenticated` Data API roles are denied everything, while the app (connecting as the table owner, without
`FORCE ROW LEVEL SECURITY`) is unaffected. Tables added by future migrations must have RLS enabled the same way. Never expose the service role key to the browser — this app never uses Supabase keys at all.

## Reporting vulnerabilities
Email the support address configured in Admin → Settings with "SECURITY" in the subject.
