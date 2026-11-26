# SOAR Hub

**SOAR** (Scholarship · Opportunity · Access · Resources) **Hub** helps young Africans, starting with Nigeria, find
fully funded Mastercard Foundation partner scholarships, check whether they are eligible, and prepare a complete,
strong application before the deadline.

**Live site:** <https://soar-hub.vercel.app>

SOAR Hub does **not** submit applications and does **not** decide who wins. Applicants always submit on the official
university or scholarship portal. SOAR Hub gets them ready: the right documents, a plan built backward from the
deadline, reviewed essays, referee letters collected, and reminders so nothing slips.

---

## Contents

1. [What the app does](#1-what-the-app-does)
2. [Who uses it (roles)](#2-who-uses-it-roles)
3. [How it works, step by step](#3-how-it-works-step-by-step)
4. [Free and paid pages (membership)](#4-free-and-paid-pages-membership)
5. [AI essay critique](#5-ai-essay-critique)
6. [Tech stack and architecture](#6-tech-stack-and-architecture)
7. [Project structure](#7-project-structure)
8. [Running it on your computer](#8-running-it-on-your-computer)
9. [Environment variables](#9-environment-variables)
10. [Integrations](#10-integrations)
11. [Scheduled jobs](#11-scheduled-jobs)
12. [Free hosting (Vercel + Supabase)](#12-free-hosting-vercel--supabase)
13. [Security and privacy](#13-security-and-privacy)
14. [Testing](#14-testing)
15. [Scripts](#15-scripts)
16. [Known limitations](#16-known-limitations)
17. [Troubleshooting](#17-troubleshooting)
18. [More documentation](#18-more-documentation)

---

## 1. What the app does

| Area | What the applicant gets |
|---|---|
| **Scholarship directory** | 35 real Mastercard Foundation partner scholarships, grouped as *Undergraduate in Africa*, *Undergraduate outside Africa* and *Postgraduate*. Each one has the school logo, the current and next application window, key eligibility, benefits, required documents (split into *Admission* and *Scholarship* stages), the official source link and the date it was last verified. Filters by group, level, country and status (Open, Opens soon, Not announced, Closed), with a cards or table view. |
| **Eligibility check** | Compares the applicant's profile with the scholarship's rules and answers **Likely eligible**, **More information needed** or **Not eligible**, criterion by criterion, with what is missing. |
| **Application plan** | Starting an application creates a document checklist and a set of tasks scheduled backward from the deadline (milestone templates set by admins). |
| **Planner** | List, calendar and timeline views of every task across all applications. |
| **Documents** | Private uploads with file-type checks (by content, not just the extension), versions, and optional review by a coach. |
| **Essays & answer bank** | Versioned essays, reviewer comments anchored to highlighted passages, rubric scoring, optional AI critique (approved by a human), and an answer bank of reusable answers. |
| **Referees** | A referee gets a secure, time-limited upload link by email (no account needed). The letter lands in the application checklist automatically. |
| **Notifications** | In-app bell and email for reminders, overdue tasks, referee activity, reviews and status changes. |
| **Learning** | Application guide (built from the webinar), learning resources (SOP, CV and recommendation letter samples, explained), and an FAQ. |
| **Privacy tools** | Export all your data, or ask for it to be deleted. |

Admins and reviewers get dashboards to manage scholarships, rules, content, users, reviews, payments, notifications,
analytics and an append-only audit log.

## 2. Who uses it (roles)

| Role | What they can do |
|---|---|
| **Visitor** (not signed in) | Home, About, Contact, FAQ, Membership page, sign up. |
| **Applicant** | Everything in section 1 once their email is verified **and** their membership is active. |
| **Reviewer / Coach** | Reviewer dashboard: assigned applications, document review queue, essay review queue, AI approval queue. |
| **Administrator** | Admin dashboard: applicants, applications, scholarships (with eligibility rules, documents, milestones, rubrics, sources, history), content, notifications and templates, payments, analytics, audit log, settings, jobs. |
| **Super administrator** | Everything an admin can do, plus users, roles and permissions. |

Staff roles (reviewer and above) never need a membership.

## 3. How it works, step by step

### Applicant journey

1. **Sign up** at `/register` with name, email, password and consent. The password is hashed with scrypt.
2. **Verify email.** SOAR Hub emails a verification link. Until it is clicked, protected pages stay locked.
3. **Member ID.** After sign-up every account gets a unique member ID like `SOAR-26-7KQ4MZ`
   (`SOAR-` + two-digit year + 6 characters from an alphabet without look-alike characters such as 0/O and 1/I/L).
   It is shown on the dashboard and in settings, and admins can search by it.
4. **Membership.** The applicant opens `/membership` and pays **₦25,000 for 12 months** with Flutterwave (card,
   bank transfer or USSD). See [section 4](#4-free-and-paid-pages-membership).
5. **Onboarding.** A short profile in five steps: personal, education, background (sensitive questions are optional),
   goals and consent.
6. **Find scholarships**, save them, and run **Check my eligibility**.
7. **Start an application plan.** The checklist and the backward-scheduled tasks appear.
8. **Prepare.** Upload documents, request referee letters, write essays and send them for review (and AI critique if
   it's on), tick off tasks in the planner. Reminders arrive by email and in the app.
9. **Mark as submitted.** This unlocks only when every *required* document is ready and every required task is done.
   The applicant enters the confirmation number from the official portal.
10. **Outcome.** Admins move the application to *Shortlisted* and record the *Outcome* (awarded, declined,
    waitlisted, not selected…). The applicant sees each change.

### Application states

```
draft → screening → eligible / ineligible → in_progress → submitted → shortlisted → outcome
```

Every move goes through a state machine (`src/lib/engine/state-machine.ts`) that checks who may make it and whether
its conditions hold (for example, the checklist must be complete before *submitted*). Every move is written to the
status history and the audit log.

### Eligibility engine

Each scholarship has a set of criteria built from a shared rule library (age, citizenship, education level, grades,
exams, financial need, etc.). Rules can be *absolute* (failing one makes you ineligible) or *preferred*. Missing
profile answers give **More information needed** rather than a wrong answer. Admins can preview rules against test
profiles before saving.

### Scholarship windows

Each scholarship stores its current and next window. The `scholarship-expiry` job closes a window once its deadline
passes, so the status changes from *Open* to *Closed* automatically. An admin can open a new window with a new
deadline.

## 4. Free and paid pages (membership)

**Free for everyone:** Home, About, Contact, FAQ, Membership, sign-up, sign-in, password reset, privacy and terms.

**Members only:** the full scholarship directory and scholarship pages, eligibility, applications, planner,
documents, essays, referees, the learning library and the application guide.

How SOAR Hub knows who has paid:

- Payments are stored in the `payments` table and memberships in the `memberships` table (`starts_at`, `expires_at`, `revoked_at`).
- A user is a member when they have a membership that is not revoked and whose `expires_at` is in the future
  (demo and hand-granted memberships can have no end date). Admins can switch the paywall off entirely with
  **Require a paid membership** in settings.
- `requireUser()` and `requireMemberPage()` run on every protected page and send non-members to `/membership`.
  Server actions use `assertUser()` with the same check.

How a payment works:

1. **Pay and join** on `/membership` creates a pending payment with a unique reference and opens Flutterwave's
   hosted checkout (`/v3/payments`).
2. After paying, Flutterwave sends the user back to `/membership/callback`. SOAR Hub **does not trust the redirect**: it
   asks Flutterwave to verify the transaction (`/v3/transactions/{id}/verify`) and checks the amount, currency and
   reference.
3. Flutterwave also calls the webhook `/api/webhooks/flutterwave`. The `verif-hash` header must match
   `FLW_SECRET_HASH`, and the transaction is verified again.
4. A database row lock makes sure the callback and the webhook can't both activate the same payment. A paid
   transaction ID can only be used once.
5. The membership starts (or is extended by 12 months if one is still active) and a receipt appears on
   `/membership`.

Admins can change the price and length in **Admin → Settings → Membership & payments**, see all payments in
**Admin → Payments**, and grant or revoke a membership by hand on an applicant's page. Full guide:
[docs/PAYMENTS_SETUP.md](docs/PAYMENTS_SETUP.md).

## 5. AI essay critique

SOAR Hub can ask Claude (Anthropic) to write a **structured critique** of an applicant's essay. It is designed to
coach, never to ghost-write.

### What it does, and what it never does

| It does | It never does |
|---|---|
| Points out strengths and areas to improve | Rewrite the essay or write new sentences for the applicant |
| Quotes short passages (under 25 words) and comments on them | Invent facts, achievements or experiences |
| Finds claims that need evidence | Predict whether the applicant will win |
| Asks questions that help the applicant reflect | Judge eligibility |
| Scores the essay against a rubric | Change the applicant's voice |
| Lists the top revision priorities and checks the word count | Follow instructions hidden inside the essay text |

### The rubric (12 dimensions)

If a scholarship has its own essay rubric (set in **Admin → Scholarships → Essay rubric**), that one is used.
Otherwise the default rubric applies:

| # | Dimension | # | Dimension |
|---|---|---|---|
| 1 | Clarity | 7 | Authenticity |
| 2 | Specificity | 8 | Reflection |
| 3 | Evidence | 9 | Leadership |
| 4 | Narrative structure | 10 | Community impact |
| 5 | Relevance to the prompt | 11 | Career goals |
| 6 | Alignment with the Foundation's values | 12 | Word count |

Each dimension gets a rating: **strong**, **developing**, **needs work** or **not applicable**, with a short comment.

### What the critique contains

The model must return JSON that matches a strict schema (`CritiqueSchema` in `src/lib/integrations/ai.ts`):

- `overall_summary`: a short overview
- `strengths`
- `areas_for_improvement`
- `specific_observations`: a short quote from the essay plus an observation about it
- `evidence_gaps`: claims that need an example or a number
- `questions_to_consider`: reflection questions for the applicant
- `rubric_evaluation`: one rating and comment per rubric dimension
- `revision_priorities`: the few things to fix first
- `word_count_compliance`: whether the essay fits the limit

### The human-approval workflow

AI output is **never shown to the applicant directly**.

```
Applicant submits essay version
        │
        ▼
AI critique requested ──► Claude generates JSON ──► safety checks
        │                                                │
        │                               fails ──► marked failed, logged, not shown
        ▼                                                │
  pending in the AI approval queue ◄────────── passes ───┘
        │
        ▼
Reviewer (or admin) opens it:  Approve  ·  Edit, then approve  ·  Flag  ·  Reject
        │
        ▼
Only an approved critique is shown to the applicant, labelled as AI-assisted and reviewed by a person
```

Reviewers work in **Reviewer → AI queue**, **Admin → AI queue**, or directly on the essay's review page. Every
decision is recorded in `ai_critique_approvals` and the audit log, with who decided and when.

### Safety checks

Before a critique reaches the queue, `checkCritiqueSafety()` rejects it if:

- any single item is longer than 1,500 characters;
- a quote is longer than 40 words;
- it uses guarantee language ("guarantee", "you will be selected / win / get the scholarship");
- its longest item repeats more than 60% of the essay's words (i.e. it looks like a rewrite).

The system prompt also tells the model to ignore any instructions written inside the essay (prompt-injection
protection), to quote briefly, to stay factual, and to use only the essay and the prompt it was given.

### When it runs

- **On submit:** when the applicant submits an essay version and automatic generation is ticked
  (`ai_auto_generate_on_submit`), a critique is generated straight away.
- **On request:** a reviewer can request one from the essay page.
- **Queue and retries:** the `ai-critiques` job (every 5 minutes) processes pending requests. A request stuck in
  *generating* for more than 5 minutes (for example, a serverless function was stopped) is put back in the queue,
  up to 3 attempts in total. After that it is marked failed and can be requested again.

### Model and settings

- Provider: Anthropic, through the official `@anthropic-ai/sdk`.
- Model: `claude-opus-5-5` by default (override with `AI_MODEL`).
- Effort: medium, with up to 16,000 output tokens.
- Structured output: `client.beta.messages.parse()` with a Zod schema, so the response is validated before it is
  stored.
- Server-side fallback is enabled, so a request still completes if the main model is briefly overloaded.
- Prompt version `critique-v1` is stored with every critique, so results can be compared when the prompt changes.
- Errors (bad key, no credit, rate limit, network) are turned into clear messages for admins; the applicant only sees
  "feedback is being prepared".

### Turning it on

1. Create an API key at **console.anthropic.com** and add credit (pay-as-you-go).
2. Set these in `.env` locally, or in Vercel → Settings → Environment Variables (then redeploy):
   ```bash
   AI_PROVIDER=anthropic
   AI_API_KEY=your-key-here
   # optional
   AI_MODEL=claude-opus-5-5
   ```
3. **Admin → Settings → Integrations** should show *AI critique: Anthropic Claude, Active*.
4. **Admin → Settings**: tick **Enable AI-assisted essay critique** and, if you like, **Generate a draft critique
   automatically when an essay is submitted**, then save.
5. Click **Run a test critique** to check the key and the model with a sample essay.

**Cost:** each critique is a single API call, typically a few cents to a few tens of cents depending on the essay
length and the model. With auto-generate off, critiques run only when a reviewer asks for one. Without a key the
feature is simply hidden; everything else works.

Full guide: [docs/AI_SETUP.md](docs/AI_SETUP.md).

## 6. Tech stack and architecture

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, React Server Components, server actions), TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL 16 with pgvector, through Drizzle ORM and node-postgres (`pg`) |
| Auth | Own session system: scrypt password hashes, HTTP-only cookies, idle and absolute timeouts, CSRF and origin checks, rate limits |
| File storage | Local disk in development; any S3-compatible store in production (Supabase Storage) |
| Email | Gmail SMTP (nodemailer), Resend or SendGrid; console in development |
| Payments | Flutterwave |
| AI | Anthropic Claude (essay critique); optional embeddings for search |
| Malware scanning | ClamAV (optional) |
| Hosting | Vercel (Hobby) + Supabase (Free) + cron-job.org |
| Tests | Vitest (unit, integration), Playwright (end-to-end, accessibility, mobile) |

```
Browser ──► Next.js pages & server actions ──► services (src/lib/services)
                                                 │      │
                                engines (rules,  │      └─► integrations: email · storage · Flutterwave · Claude · ClamAV
                                state machine,   │
                                scheduler)  ◄────┘
                                                 ▼
                                          PostgreSQL (Drizzle)
Cron (cron-job.org / Vercel) ──► /api/cron/[group] ──► jobs (reminders, notifications, AI queue, expiry…)
```

- **Pages** only render and call **services**; all business rules live in services and engines, so they are tested
  without a browser.
- **Engines** are pure functions: eligibility, state machine, scheduler (backward planning), file validation.
- **Integrations** each have a "not configured" mode, so the app runs without any external account.
- On Vercel, the database pool is attached with `attachDatabasePool` and idle connections close after 5 seconds, so
  a frozen function never holds a dead connection.

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 7. Project structure

```
src/
  app/
    (public)/       home, about, contact, faq, membership, privacy, terms, scholarships, guide, resources
    (auth)/         register, login, verify-email, forgot-password, reset-password
    (portal)/       applicant area: dashboard, onboarding, profile, eligibility,
                    applications, planner, documents, essays, answer-bank, referees, learn, notifications, settings
    admin/          admin dashboard (applicants, applications, scholarships, eligibility-rules, content,
                    ai-queue, document-reviews, essay-reviews, referees, notifications, payments,
                    analytics, audit, data-requests, users, settings)
    reviewer/       reviewer dashboard (applications, documents, essays, ai-queue)
    referee/        public referee upload page (token link)
    api/            cron, health, files, webhooks (email, flutterwave, sms), admin export
    downloads/      learning-resource downloads
  lib/
    services/       business logic (auth, membership, applications, essays, eligibility, documents, …)
    engine/         pure rule engines (eligibility, state machine, scheduler, file validation)
    integrations/   ai, email, storage, flutterwave, malware, embeddings, sms
    db/             Drizzle schema and connection
    data/           FAQ and static content
content/            scholarship dataset, learning resources, downloadable files
drizzle/            SQL migrations
scripts/            seeding, imports, admin creation, worker, user deletion, logo fetch
tests/              unit, integration and e2e tests
docs/               detailed guides
```

## 8. Running it on your computer

You need **Node.js 20+** and **PostgreSQL 16 with pgvector** (or Docker).

```bash
git clone https://github.com/DropTraQ/soar-hub2.git
cd soar-hub2
npm install
cp .env.example .env
```

Edit `.env`: at minimum set `DATABASE_URL` and a long random `SESSION_SECRET` (`openssl rand -base64 48`).

```bash
npm run demo:setup
npm run dev
```

Open <http://localhost:3000>. `demo:setup` applies migrations, loads the scholarships and learning resources, and
creates demo accounts (password `Soar-demo-2026!` unless `DEMO_PASSWORD` is set):

| Role | Email |
|---|---|
| Super admin | `superadmin@demo.soarhub.ng` |
| Admin | `admin@demo.soarhub.ng` |
| Reviewer | `reviewer@demo.soarhub.ng` |
| Applicant | `applicant@demo.soarhub.ng` (completed profile, an application in progress, active membership) |

**Never create the demo accounts on the live site:** their password is public.

In development every email is also written to `.dev-storage/outbox.jsonl` and shown at
<http://localhost:3000/dev/mailbox> (this page does not exist in production). To run scheduled jobs locally, run
`npm run worker` in a second terminal, or use **Admin → Settings → Run job**.

Step-by-step guides: [docs/INSTALLATION.md](docs/INSTALLATION.md), and a full walkthrough of every feature in
[docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

## 9. Environment variables

Copy `.env.example` to `.env`. **Never commit `.env`** and never paste its values into chat, issues or screenshots.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string (add `?sslmode=require` for Supabase) |
| `DATABASE_POOL_MAX` | no | Pool size (use `3` on Vercel) |
| `APP_URL` | yes | Public address, used in email links and the payment return page |
| `SESSION_SECRET` | yes | Signs session cookies (48+ random characters) |
| `SESSION_IDLE_MINUTES`, `SESSION_ABSOLUTE_HOURS` | no | Sign-out after inactivity / maximum session length |
| `CRON_SECRET` | production | Protects `/api/cron/*` (sent as `Authorization: Bearer <secret>`) |
| `STORAGE_DRIVER` | no | `local` (default) or `s3` |
| `STORAGE_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | with s3 | S3-compatible storage (Supabase) |
| `LOCAL_STORAGE_DIR` | no | Folder for local uploads |
| `EMAIL_PROVIDER` | no | `console` (default), `smtp`, `resend` or `sendgrid` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | with smtp | Gmail: your address and an App Password |
| `EMAIL_PROVIDER_API_KEY` | with resend/sendgrid | API key |
| `EMAIL_FROM` | yes for real email | e.g. `SOAR Hub <you@gmail.com>` |
| `EMAIL_WEBHOOK_SECRET` | no | Delivery webhooks |
| `FLW_SECRET_KEY`, `FLW_SECRET_HASH` | for payments | Flutterwave secret key and webhook hash |
| `FLW_API_BASE` | no | Override the Flutterwave API address (tests) |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` | for AI critique | `anthropic`, your key, optional model |
| `EMBEDDINGS_PROVIDER`, `EMBEDDINGS_API_KEY`, `EMBEDDINGS_MODEL` | no | Semantic search (optional) |
| `CLAMAV_HOST`, `CLAMAV_PORT` | no | Virus scanning of uploads |
| `SMS_*` | no | SMS is **off in this version** |
| `SENTRY_DSN`, `LOG_LEVEL` | no | Error reporting and logging |

## 10. Integrations

Every integration is optional and shows its status in **Admin → Settings → Integrations**.

| Integration | Status on the live site | Guide |
|---|---|---|
| Email (Gmail SMTP) | Active | [docs/EMAIL_SETUP.md](docs/EMAIL_SETUP.md) |
| Payments (Flutterwave) | Active (test mode) | [docs/PAYMENTS_SETUP.md](docs/PAYMENTS_SETUP.md) |
| File storage (Supabase S3) | Active | [docs/FREE_HOSTING.md](docs/FREE_HOSTING.md) |
| AI critique (Anthropic) | Ready; needs an API key | [docs/AI_SETUP.md](docs/AI_SETUP.md) |
| Embeddings | Not configured (optional) | [docs/INTEGRATIONS_SETUP.md](docs/INTEGRATIONS_SETUP.md) |
| Malware scanning (ClamAV) | Not configured (needs its own server) | [docs/INTEGRATIONS_SETUP.md](docs/INTEGRATIONS_SETUP.md) |
| SMS | Off in this version | — |

## 11. Scheduled jobs

| Group | How often | Jobs |
|---|---|---|
| `frequent` | every 5 minutes (cron-job.org) | send queued notifications, process the AI critique queue |
| `hourly` | every hour (cron-job.org) | expire referee links, close past-deadline scholarship windows, embeddings backfill |
| `daily` | once a day (Vercel cron) | milestone reminders, overdue reminders, referee reminders, analytics, clean-up |

Each group is called at `/api/cron/<group>` with the header `Authorization: Bearer <CRON_SECRET>`. Admins can also
run any single job from **Admin → Settings**.

## 12. Free hosting (Vercel + Supabase)

The live site runs entirely on free plans:

- **Vercel (Hobby)** runs the app and rebuilds on every push to `main`. Functions run in Dublin (`dub1`, set in
  `vercel.json`), next to the database.
- **Supabase (Free)** provides PostgreSQL (through the transaction pooler, port 6543) and the private
  `soar-documents` storage bucket.
- **cron-job.org** calls the `frequent` and `hourly` job groups.
- **Gmail** sends the emails; **Flutterwave** takes the payments.

To publish a database change, run the migrations against Supabase from your computer
(`DATABASE_URL=... npm run db:migrate`). The full step-by-step guide is in
[docs/FREE_HOSTING.md](docs/FREE_HOSTING.md); for paid or self-hosted options see
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## 13. Security and privacy

- Passwords hashed with scrypt (memory-hard); sessions in HTTP-only, secure, same-site cookies with idle and absolute timeouts.
- Email verification required before protected pages; rate limits on sign-in, sign-up and password reset.
- Role-based permissions checked on the server for every page and action.
- Uploads are private, checked by their real content type and size, optionally virus-scanned, and served only
  through permission-checked short-lived links.
- Referee links are single-use and expire.
- Payments are always verified with Flutterwave on the server; webhooks need the secret hash.
- AI output is safety-checked and approved by a person before an applicant sees it.
- Sensitive profile questions are optional; consent is recorded; users can export or delete their data (Nigeria Data
  Protection Act).
- An append-only audit log records every important change.

Details: [docs/SECURITY.md](docs/SECURITY.md).

## 14. Testing

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
```

- **Unit:** eligibility engine, state machine, scheduler, member codes, dataset checks, learning content.
- **Integration** (needs a test database): full workflows and membership payments against a mock Flutterwave.
- **End-to-end** (Playwright): applicant journey A–Z, admin, reviewer, accessibility and mobile.

See [docs/TESTING.md](docs/TESTING.md).

## 15. Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Production build / run it |
| `npm run lint`, `npm run typecheck` | Code checks |
| `npm run db:generate` | Create a migration from schema changes |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Base data (roles, permissions, settings, rule library, templates) |
| `npm run db:seed:demo` | Demo accounts (local only) |
| `npm run db:import-scholarships` | Load the 35 partner scholarships |
| `npm run db:import-resources` | Load the learning resources |
| `npm run demo:setup` | All of the above for a local demo |
| `npm run db:create-admin` | Create an admin (`ADMIN_EMAIL=… ADMIN_FIRST_NAME=… ADMIN_LAST_NAME=…`); prints a one-time password |
| `npm run users:delete -- <email> --yes` | Delete an account so the email can be reused (without `--yes` it only shows what would be deleted) |
| `npm run logos:fetch` | Download school logos |
| `npm run worker` | Run the scheduled jobs locally |
| `npm test` | All tests |

## 16. Known limitations

- Vercel's Hobby plan is for non-commercial use. Once real members pay real money, move to a paid plan or another
  host.
- Supabase pauses a free project after a week with no traffic (the cron calls keep it awake).
- No virus scanning on the free setup: uploads are marked "not scanned".
- Videos can't be uploaded directly; applicants upload a document containing a private link.
- SMS is not part of this version.
- Scholarship details come from official pages and change between rounds; admins must re-verify them each cycle.

## 17. Troubleshooting

| Problem | Fix |
|---|---|
| "Something went wrong" on every page | The database isn't reachable, or `DATABASE_URL` is wrong. |
| 504 on Vercel | Function region far from the database: keep both in the same region (`dub1` ↔ Supabase West EU). |
| "password authentication failed" | Wrong password in `DATABASE_URL`; fix it in Vercel and redeploy. |
| No emails arrive | Check **Admin → Settings → Test email delivery**; for Gmail use an App Password, not your normal password. |
| Payment succeeded but no membership | Check the Flutterwave webhook URL and that `FLW_SECRET_HASH` matches; see **Admin → Payments**. |
| Cron returns 401 | The header must be exactly `Authorization: Bearer <CRON_SECRET>` (no quotes). |
| AI critique shows "not configured" | Set `AI_PROVIDER` and `AI_API_KEY`, redeploy, and tick **Enable AI-assisted essay critique** in **Admin → Settings**. |
| Sign-in blocked after many tries | Rate limiting: wait 15 minutes. |

## 18. More documentation

| Guide | About |
|---|---|
| [DEMO_SCRIPT](docs/DEMO_SCRIPT.md) | Full applicant and admin demo, A–Z |
| [USER_GUIDE](docs/USER_GUIDE.md) | For applicants |
| [ADMIN_GUIDE](docs/ADMIN_GUIDE.md) | For admins and reviewers |
| [INSTALLATION](docs/INSTALLATION.md) | Local setup in detail |
| [FREE_HOSTING](docs/FREE_HOSTING.md) | Putting it online for free |
| [DEPLOYMENT](docs/DEPLOYMENT.md) | Other hosting options |
| [EMAIL_SETUP](docs/EMAIL_SETUP.md) | Gmail, Resend, SendGrid |
| [PAYMENTS_SETUP](docs/PAYMENTS_SETUP.md) | Flutterwave |
| [AI_SETUP](docs/AI_SETUP.md) | Claude essay critique |
| [INTEGRATIONS_SETUP](docs/INTEGRATIONS_SETUP.md) | Storage, malware scanning, embeddings |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | How the code is organised |
| [API](docs/API.md) | HTTP endpoints, webhooks and cron |
| [SECURITY](docs/SECURITY.md) | Security model |
| [TESTING](docs/TESTING.md) | Running the tests |
| [CHECKLIST](docs/CHECKLIST.md) | Launch checklist |

---

SOAR Hub is independent and is not run by the Mastercard Foundation or any partner university. Universities make all
admission and scholarship decisions.
