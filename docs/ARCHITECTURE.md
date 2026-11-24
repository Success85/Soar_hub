# Architecture & key decisions

## Shape

A single Next.js application (one deployable) containing the public site, applicant portal, reviewer
workspace, admin dashboard, route handlers (files, cron, webhooks, exports, health) and the business logic.

```
src/
  app/                     routes
    (public)/              home, scholarships, resources, about, contact, legal
    (auth)/                register, login, verify-email, forgot/reset password
    (portal)/              applicant portal (+ shared account pages for staff)
    reviewer/  admin/      staff areas (own layouts, permission-gated)
    referee/[token]/       token-scoped, account-less upload page
    actions/               server actions (thin: validate → service → ActionResult)
    api/                   files, dev-storage, cron, webhooks, exports, health
  lib/
    engine/                PURE logic, exhaustively unit-tested:
                           eligibility (3-valued rules + adaptive questions), scheduler (DAG backward
                           planning), state machine, file validation, notification keys
    services/              database-backed domain services (the only place SQL lives)
    integrations/          storage, email, SMS, AI, embeddings, malware — each reports configured/missing
    auth/                  password (scrypt), tokens (HMAC), sessions, permissions
    db/                    Drizzle schema + client
  components/              UI primitives, layouts, feature components
drizzle/                   SQL migrations (0000 schema, 0001 append-only/immutability triggers)
scripts/                   migrate, seed, create-admin, worker
tests/                     unit, integration (real Postgres), e2e (Playwright)
```

Request flow: **page / server action → `assertUser`/`assertPermission` → service → database**. UI role checks
exist only for display; every mutation re-checks authorisation in the service or action.

## Decisions (and why)

| Decision | Rationale |
|---|---|
| **Own auth instead of Supabase Auth** | Works identically on Supabase Postgres or any Postgres; fully testable locally; sessions are revocable rows (needed for 30-minute idle expiry, "sign out everywhere", suspension). Passwords use Node's built-in scrypt; tokens are 256-bit random and stored only as HMAC-SHA256. |
| **Drizzle + hand-reviewed SQL migrations** | No binary engine to download, typed queries, plain SQL for triggers. |
| **Server Actions for mutations** | Built-in CSRF protection (Next.js checks Origin), progressive enhancement, no hand-written fetch layer. Route handlers are used only where a URL is required (downloads, cron, webhooks, CSV). |
| **Rules as data** | Eligibility criteria live in `scholarship_criteria` (+ AND/OR groups). Code contains only the catalogue of applicant data points (`engine/fields.ts`) and the operator semantics. |
| **Three-valued logic** | Missing data ⇒ *Undetermined*, never *Ineligible*. Groups use Kleene AND/OR; only required criteria affect the verdict. |
| **Adaptive questions** | Asks only decisive, unknown fields; skips scholarships already decided; defers sensitive questions; ranks by absolute-criterion impact and breadth. |
| **Backward scheduler** | Topological sort with cycle detection; ALAP planning from the deadline with an automatic safety buffer; when time is short it compresses optional tasks first, then proportionally, never dating anything in the past, and returns warnings + a priority plan. |
| **Guarded state machine** | `engine/state-machine.ts` is the single source of allowed transitions, actors and guards (documents, tasks, eligibility, reasons for overrides). |
| **Notifications outbox** | Every message is a row with a unique idempotency key; delivery is claimed with `FOR UPDATE SKIP LOCKED`, retried at 5/15/60 minutes, then marked failed for manual retry. Secret links are scrubbed from storage after sending. |
| **AI behind a human gate** | AI output is schema-validated, safety-checked (no rewrites, no guarantees), stored as *pending*, and reaches the applicant only via `approveCritique`, which a human must call. |
| **Append-only audit** | Database triggers block UPDATE/DELETE/TRUNCATE on `audit_logs`; document versions' file fields are immutable and versions cannot be deleted. |
| **Private storage only** | No public URLs. Downloads go through `/api/files/:versionId` (authorisation + access logging) and redirect to a 120-second signed URL. The local driver is refused in production. |
| **Postgres-backed rate limiting** | Works across serverless instances without extra infrastructure. |
| **pgvector without fixed dimension** | Answer banks are small and per-user, so exact search is fast; switching embedding model doesn't need a migration (rows are filtered by model). Keyword full-text search is the clearly labelled fallback. |

## Data model (59 tables)

Identity: `users, sessions, auth_tokens, user_roles, role_permissions, consents, profiles`.
Scholarships: `scholarships, scholarship_revisions, scholarship_sources, scholarship_criteria_groups,
scholarship_criteria, scholarship_document_requirements, scholarship_milestone_templates, scholarship_files,
essay_rubrics, saved_scholarships`.
Eligibility: `eligibility_assessments, eligibility_assessment_answers, eligibility_results`.
Applications: `applications, application_state_transitions, reviewer_assignments, application_milestones,
milestone_dependencies`.
Documents: `application_documents, document_versions, document_reviews, document_comments,
document_comment_anchors`.
Essays/AI: `essays, essay_versions, essay_reviews, essay_feedback, ai_critique_requests, ai_critique_results,
ai_critique_approvals`. Answer bank: `answer_bank_entries, answer_bank_embeddings, prompt_embeddings`.
Referees: `referee_requests, referee_uploads`.
Notifications: `notifications, notification_delivery_attempts, notification_preferences, notification_templates`.
Content: `educational_resources, content_categories, content_tags, resource_tags, contact_messages`.
Platform: `audit_logs, user_activity, platform_settings, rate_limits, data_requests, job_runs, analytics_daily`.

Retention: applications, documents and versions use `RESTRICT`/soft-delete so deleting or anonymising a user,
or deactivating a scholarship, never destroys history needed for audit.
