# Production deployment

Recommended, low-maintenance topology for a solo developer:

| Concern | Service |
|---|---|
| App + API + cron | **Vercel** (project root directory: `soar-hub`) |
| PostgreSQL + pgvector + backups | **Supabase** |
| Private file storage | **Supabase Storage** via its S3-compatible endpoint (or AWS S3 / Cloudflare R2) |
| Email | **Resend** (or SendGrid) |
| SMS (optional) | **Africa's Talking** |
| AI critique (optional) | **Anthropic** (or OpenAI) |
| Source & CI | GitHub + the included workflow `.github/workflows/soar-hub-ci.yml` |

## 1. Repository
Push this repository to GitHub. CI runs typecheck, lint, unit/integration tests, build and the E2E suite.

## 2. Database (Supabase)
1. Create a project in a region close to Nigeria (e.g. `eu-west`).
2. Database → Extensions → enable **vector**.
3. Copy the connection strings:
   - **Transaction pooler** (port 6543) → `DATABASE_URL` on Vercel (serverless-safe; the client uses `prepare: false`).
   - **Direct/session** connection (port 5432) → use for running migrations from your machine/CI.
4. Run migrations and base seed (never `seed:demo` in production):
   ```bash
   DATABASE_URL="<direct connection>" npm run db:migrate
   DATABASE_URL="<direct connection>" npm run db:seed
   ```
5. Create the first super administrator (prints a one-time password unless you pass `ADMIN_PASSWORD`):
   ```bash
   DATABASE_URL="<direct connection>" ADMIN_EMAIL=you@org.ng ADMIN_FIRST_NAME=Your ADMIN_LAST_NAME=Name npm run db:create-admin
   ```
   Sign in and change the password from Settings immediately.

## 3. Storage (Supabase Storage)
1. Storage → create a **private** bucket `soar-documents` (no public access).
2. Storage → Settings → S3 Connection: enable, create an access key.
3. Set `STORAGE_DRIVER=s3`, `STORAGE_BUCKET=soar-documents`, `S3_ENDPOINT=https://<ref>.supabase.co/storage/v1/s3`,
   `S3_REGION=<project region>`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE=true`.

## 4. Email (Resend)
1. Add and verify your sending domain (SPF/DKIM DNS records).
2. `EMAIL_PROVIDER=resend`, `EMAIL_PROVIDER_API_KEY=re_…`, `EMAIL_FROM="SOAR Hub <no-reply@your-domain.ng>"`.
3. Webhooks → add `https://<domain>/api/webhooks/email` for `email.delivered`, `email.bounced`, `email.complained`;
   put the signing secret in `EMAIL_WEBHOOK_SECRET`.
   (SendGrid: Event Webhook URL `https://<domain>/api/webhooks/email?secret=<EMAIL_WEBHOOK_SECRET>`.)

## 5. AI (optional)
`AI_PROVIDER=anthropic`, `AI_API_KEY=sk-ant-…` (model defaults to `claude-opus-5-5`; override with `AI_MODEL`).
The Anthropic integration enables server-side refusal fallbacks. Without these variables, essays go straight to
human review. Semantic answer-bank search: `EMBEDDINGS_PROVIDER=openai|voyage` + `EMBEDDINGS_API_KEY`.

## 6. SMS (optional)
`SMS_PROVIDER=africastalking`, `SMS_PROVIDER_USERNAME`, `SMS_PROVIDER_API_KEY`, optional `SMS_SENDER_ID`.
Delivery reports: `https://<domain>/api/webhooks/sms?secret=<SMS_WEBHOOK_SECRET>`. Use username `sandbox` to test.

## 7. Vercel
1. Import the repo; set **Root Directory** = `soar-hub`; framework Next.js.
2. Environment variables: everything in `.env.example` that applies, plus `NODE_ENV=production`,
   `APP_URL=https://<your-domain>`, a fresh `SESSION_SECRET` (`openssl rand -base64 48`) and `CRON_SECRET`.
   The app **refuses to start** in production with `STORAGE_DRIVER=local`, `EMAIL_PROVIDER=console`, or missing secrets.
3. Deploy. Check `https://<domain>/api/health` returns `{"status":"ok"}`.

## 8. Domain & HTTPS
Add your domain in Vercel → Domains, create the DNS records shown, and Vercel provisions TLS automatically.
HSTS (`max-age=63072000; includeSubDomains; preload`) and the CSP are sent in production by `next.config.ts`.
Update `APP_URL` to the final domain.

## 9. Background jobs
`vercel.json` schedules `/api/cron/frequent` (every 5 min: notification delivery, AI critiques), `/hourly`
(referee expiry, scholarship expiry, embeddings) and `/daily` (milestone/overdue/referee reminders, analytics,
cleanup). Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.

> Vercel **Hobby** plans only allow daily crons. On Hobby, keep `/daily` on Vercel and call
> `/api/cron/frequent` every 5 minutes from an external scheduler (e.g. a GitHub Actions `schedule` workflow or
> cron-job.org) with the bearer header — or run `npm run worker` on any always-on host. Run **one** scheduler only;
> jobs are idempotent regardless.

Verification and password-reset emails are sent immediately (not via cron).

## 10. Monitoring & logging
- `/api/health` for uptime monitoring (e.g. Better Stack / UptimeRobot).
- Server logs are structured JSON (`level`, `msg`) — use Vercel Log Drains to ship them.
- Admin → Notifications shows failed deliveries; Admin → Settings shows integration status and job runs.
- `SENTRY_DSN` is reserved; adding `@sentry/nextjs` is a documented follow-up (see CHECKLIST).

## 11. Backups & restore
- Supabase Pro includes daily backups; enable **Point-in-Time Recovery** for production.
- Additionally schedule a logical backup: `pg_dump --format=custom "$DIRECT_URL" > soar-$(date +%F).dump`
  stored off-platform (encrypted). Test restores quarterly: `pg_restore --clean --no-owner -d "$TARGET_URL" file.dump`.
- Storage: enable bucket versioning/replication where available, or periodically sync with `aws s3 sync`.

## 12. Rollback
- App: Vercel → Deployments → *Promote to Production* on the previous deployment (instant).
- Database: migrations are forward-only and additive. Before a risky migration take a backup; to roll back,
  restore the backup (PITR) and redeploy the matching app version. Never edit an applied migration.

## 13. Security checklist (go-live)
- [ ] Unique `SESSION_SECRET`, `CRON_SECRET`, webhook secrets; no secrets in git.
- [ ] `STORAGE_DRIVER=s3` with a private bucket; `EMAIL_PROVIDER` real provider with verified domain.
- [ ] `APP_URL` is https; HSTS active; custom domain only.
- [ ] Demo data **not** seeded (`SEED_DEMO` unset); `npm run db:seed` only.
- [ ] Super admin created via `db:create-admin`; password changed; additional staff via Admin → Users.
- [ ] Privacy policy and terms reviewed by Nigerian counsel and published in Admin → Settings.
- [ ] Supabase: confirm RLS is on for every table (migration `0002_enable_rls` does this; re-run its loop after
      adding tables) — it blocks the public Data API while the owner-role app is unaffected.
- [ ] Backups + PITR on; restore tested. Uptime monitor on `/api/health`.
- [ ] Optional: ClamAV (`CLAMAV_HOST`) for malware scanning.

## Troubleshooting
| Symptom | Fix |
|---|---|
| `Production configuration error: …` | Set the named variables; production refuses dev-only drivers. |
| `type "vector" does not exist` during migrate | Enable the pgvector extension, then rerun. |
| Emails not arriving | Admin → Notifications shows the provider error; verify the sending domain. |
| `prepared statement … already exists` | Use the Supabase *transaction pooler* URL (the client disables prepared statements). |
| Cron returns 401 | `CRON_SECRET` mismatch between Vercel env and scheduler. |
| Users signed out often | Expected after 30 minutes of inactivity (`SESSION_IDLE_MINUTES`). |
