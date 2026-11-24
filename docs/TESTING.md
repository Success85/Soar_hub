# Testing

## How to run
```bash
npm test                    # unit + integration (Vitest). Rebuilds TEST_DATABASE_URL (default soar_hub_test) from migrations.
npm run test:unit           # pure engines only (no DB needed after global setup)
npx playwright test tests/e2e/<file>.spec.ts   # E2E against `next dev` on :3100 (dev DB with SEED_DEMO data)
```
E2E needs `npm run db:seed:demo` on the dev database (demo accounts) and writes test users with unique emails.
Run E2E **one spec file at a time** (as CI does): running the whole suite in one process together with the dev
server exceeded this sandbox's memory once.

## Suites

**Unit (73 tests)** — `tests/unit`
- Eligibility: all 16 operators, missing-data ⇒ undetermined, Kleene AND/OR, grouped criteria, advisory criteria,
  absolute/fixable explanations, admin-supplied explanations, age calculation, derived/custom facts, adaptive
  question ordering (sensitive last, known fields skipped, early elimination, moot OR members), criteria validation.
- Scheduler: topological order, cycles/unknown/self dependencies, backward dates honour dependencies, critical path,
  compression (optional tasks first), infeasible plans never use past dates, passed deadline refused, safety buffer,
  due-today/overdue derivation, weighted progress, timezone day boundaries.
- State machine: happy path, invalid transitions, document/task/eligibility guards, actor permissions, admin reasons.
- Notification idempotency keys, 5/15/60-minute retry schedule, template rendering; token generation/expiry/single
  use/revocation; scrypt hashing and password policy; role permissions and sensitive-field redaction; upload
  validation (size, extension, magic bytes, MIME spoofing), filename sanitising, word count.

**Integration (21 tests, real PostgreSQL)** — `tests/integration/workflows.test.ts`
- Registration → emailed verification link → single-use verification → login; duplicate/weak passwords; password
  reset single-use; secret links scrubbed after sending.
- Scholarship publication rules, public visibility, deactivation preserving revisions and audit, criteria validation.
- Full applicant pipeline: adaptive questions → answers saved to profile → *likely eligible* → application screening →
  13 milestones → invalid transition blocked → submission blocked by documents, then by tasks → uploads → referee
  link (opened, submitted, reuse rejected) → submitted → outcome recorded (6+ audited transitions).
- Profile change triggers recalculation with history; missing data gives *more information needed*; deadline change
  recalculates plans and flags compression; partial profile saves never wipe other fields (regression).
- Documents: versioning, immutable/undeletable versions (DB trigger), cross-applicant and unassigned-reviewer access
  denied, assigned reviewer allowed, signed short-lived URLs, spoofed file rejected, anchors validated against the
  exact version text, review decision.
- AI critique (provider mocked): output stays unpublished, applicant cannot approve, reviewer edits + approves →
  feedback published with change record + audit; rejection requires a reason and publishes nothing.
- Notifications: idempotent enqueue; unconfigured provider → failed with logged attempt → manual retry → sent;
  milestone reminder job idempotent across runs.
- Referee links: revoke, expiry job, invalid tokens. Audit log UPDATE/DELETE/TRUNCATE blocked. Data export and
  deletion/anonymisation keeping application history. Planner custom dates validated, kept, and resettable.

**End-to-end (18 tests, Playwright, Chromium)** — `tests/e2e`
- `applicant-journey`: register → verify via emailed link → 5-step onboarding → search/save scholarship → eligibility →
  start plan → upload 3 required documents into checklist slots (and a spoofed PDF rejected) → referee request →
  referee uploads in a separate logged-out browser → token reuse blocked → complete all tasks → list/timeline/calendar
  views → submit → notification received.
- `admin`: create scholarship → add source → rule builder with preview → save criteria → required documents →
  verify → publish → visible publicly → applicants + CSV export → assign reviewer → 11 admin pages render → audit
  log shows publication → manual job run → deactivate keeps history. Authorisation: anonymous → login; applicant →
  forbidden on admin/reviewer; CSV export 403; cron without secret 401.
- `reviewer`: applicant uploads + requests review + submits essay → reviewer comments and returns document → anchored
  essay comment highlighted → completes review → applicant sees highlight, feedback and status, marks revision done.
  Unassigned applications are not found for reviewers.
- `accessibility`: axe-core (WCAG 2.0/2.1 A/AA) on 8 public pages and 4 portal pages with **zero serious/critical
  violations**; skip link + keyboard focus; form errors announced via `role=alert`.
- `mobile` (320 px): no horizontal scroll on 7 public and 7 portal pages; mobile menus work.

## Test report (latest run, this environment)
| Suite | Result |
|---|---|
| TypeScript `tsc --noEmit` | ✅ no errors |
| ESLint (`next lint`) | ✅ no warnings or errors |
| Unit + integration (Vitest) | ✅ 94 / 94 passed |
| E2E (Playwright, per file) | ✅ 18 / 18 passed (applicant 1, admin 2, reviewer 2, accessibility 11, mobile 2) |
| Production build (`next build`) | ✅ compiled; all routes built |

### Defects found by the tests and fixed
- Partial profile saves (each onboarding step) nulled fields from other steps (Zod transform on absent fields).
- Raw-SQL `Date` parameters and JS arrays (`= ANY`) mis-serialised; boolean params untyped in raw SQL.
- Raw SQL referenced non-existent `generated_at`/`requested_at` columns.
- Colour contrast failures (gold text on ivory, sidebar labels); mobile overflow from tables inside grid columns.
- Admin job-run button gave no success feedback.

### Not covered automatically
- Live third-party delivery (Resend/SendGrid, Africa's Talking, S3/Supabase Storage, Anthropic/OpenAI, embeddings,
  ClamAV) — implemented, but no credentials exist in this environment; error paths are tested.
- AI approval through the browser (covered at service level with a mocked provider).
- Screen-reader manual testing and cross-browser (Firefox/Safari) runs.
