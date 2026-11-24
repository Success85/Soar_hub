# Implementation checklist (by spec section) & known limitations

Legend: ✅ implemented and exercised by tests or browser runs · 🟡 implemented, not verified against the live
external service · ⛔ not implemented (see limitations)

| § | Requirement | Status |
|---|---|---|
| 2–3 | V1 scope: Nigerian applicants ≤29, undergraduate, partner-university scholarships; out-of-scope items not built (architecture allows masters `programme_level`) | ✅ |
| 4 | Next.js App Router + TS + Tailwind + RHF + Zod; Postgres + migrations + FKs + indexes + transactions + RLS | ✅ |
| 4 | Auth (register, verify, login/logout, reset, sessions, roles, idle expiry, deletion requests) | ✅ |
| 4 | Cloud storage (S3-compatible / Supabase Storage) | 🟡 local driver tested; S3 driver not run against a live bucket |
| 4 | Email (Resend/SendGrid), SMS (Africa's Talking), AI (Anthropic/OpenAI) provider-independent layers | 🟡 |
| 5 | Branding, responsive ≥320px, states (empty/loading/error/success), WCAG AA contrast | ✅ |
| 6 | Roles: applicant / reviewer / admin / super_admin; referee token access; backend authorisation | ✅ |
| 7 | Public site: home (hero, how it works, opportunities, features, audiences, impact, placeholder testimonials, FAQ, CTA, footer), scholarships list/detail, about, resources, contact, privacy, terms, auth pages | ✅ |
| 8 | Onboarding: registration consents, welcome, multi-step profile with explanations, completion %, save & resume | ✅ |
| 9 | Applicant dashboard from live data; navigation incl. mobile | ✅ |
| 10 | Scholarship model, statuses, official source + verification + last verified + responsible admin; only published shown | ✅ |
| 11 | Data-driven rule engine, 16 operators, 3-valued logic, explanations, overall verdict, adaptive questions, recalculation, history | ✅ |
| 12 | Applications, guarded state machine, outcomes, audit | ✅ |
| 13 | Backward scheduler, DAG, statuses, compression warnings & priority plan, recalculation on deadline change, list/timeline/calendar, custom dates, notes | ✅ |
| 14 | Notifications: email/SMS/in-app, preferences, templates, inbox, delivery status, idempotency, 5/15/60 retries, failure logs, admin retry/cancel, receipt webhooks, cron | ✅ (🟡 live providers/webhooks) |
| 15 | Documents: types, size limit (configurable), categories, versions, review statuses, signed URLs, MIME + magic-byte validation, malware scan integration | ✅ (🟡 ClamAV) |
| 16 | Anchored reviewer feedback tied to exact versions; resolve/outstanding | ✅ (anchors need extractable text) |
| 17 | Essay workspace: drafts, word count, versions, compare, submit, feedback, finalise | ✅ |
| 18 | Answer bank with pgvector semantic search, own-bank only, labelled keyword fallback | ✅ fallback · 🟡 embeddings provider |
| 19 | Structured AI critique, validation, safety checks, human approval gate with edits, provenance recorded | ✅ (mocked provider) · 🟡 live API |
| 20 | Referee requests, secure single-use 14-day tokens, upload page, statuses, reminders, expiry, revoke | ✅ |
| 21–28 | Admin: overview with charts, applicants (filters, pagination, CSV, sensitive gating), scholarship CRUD/verify/publish/duplicate/archive, rule builder (≥20 criteria, AND/OR, validation, preview), review queues, AI queue, notifications, CMS, analytics + CSV, settings | ✅ |
| 29 | Normalised schema (59 tables), soft deletion, retention-safe FKs, vector support | ✅ |
| 30 | Security controls & privacy (see SECURITY.md) | ✅ |
| 31 | Append-only audit trail (DB-enforced) | ✅ |
| 32 | Service layer, validation, error handling, pagination/search/filter/sort | ✅ |
| 33 | Unit, integration, E2E, accessibility, mobile tests | ✅ |
| 34 | Idempotent seed; demo data clearly labelled and refused in production | ✅ |
| 35 | `.env.example` | ✅ |
| 36 | Cron/worker jobs, protected, idempotent | ✅ |
| 37 | Deployment config (Vercel crons, Dockerfile, CI), docs for backups/rollback/monitoring/security | ✅ written · ⛔ not deployed |

## Known limitations (honest list)
1. **Not deployed.** Everything was built and tested locally in a sandbox; no Vercel/Supabase project exists yet.
2. **External services unverified live**: Resend/SendGrid, Africa's Talking, S3/Supabase Storage, Anthropic/OpenAI,
   OpenAI/Voyage embeddings and ClamAV are implemented against their documented APIs but were never called with real
   credentials. The app reports each as "needs configuration" and fails safely (logged, retryable) until configured.
3. **No real scholarship data.** Seeded scholarships are clearly-labelled demonstrations with example.org sources.
   Administrators must enter real partner-university opportunities from official websites.
4. **Error monitoring**: structured JSON logs only; `SENTRY_DSN` is reserved but the Sentry SDK is not integrated.
5. **CSP** allows `'unsafe-inline'` scripts (Next.js without nonces). A nonce-based CSP is a future hardening step.
6. **Anchored comments on files** require extractable text (DOCX and text PDFs); images and scanned PDFs get general
   comments only. Highlights render on extracted text, not on the original PDF layout.
7. **Legal text** (privacy policy, terms) is a template and must be reviewed by Nigerian counsel; testimonials are
   explicit placeholders.
8. **Vercel Hobby** allows only daily crons — use Pro, an external scheduler, or `npm run worker` for 5-minute jobs.
9. **Smaller gaps**: email address changes go through support; no `.ics` calendar export; rate limiting is fixed-window;
   the full E2E suite should be run per spec file (as CI does).
10. **Accessibility**: automated axe checks and keyboard tests pass; manual screen-reader testing is still recommended.
