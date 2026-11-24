# Administrator guide

Sign in and you land on **Admin → Overview**: live counts, items needing attention (each card links to the
queue), registration trend and status/verdict charts, plus a warning if an integration needs configuration.

## Publishing a scholarship (only from official sources)
1. **Scholarships → New scholarship**: name, partner university, location, benefits, programmes, official
   deadline (Lagos time) and the official application URL. This creates a *Draft*.
2. **Sources & verification**: add the official partner-university page. Open it, check every detail, then
   **Mark source verified** (records you and the date as "last verified"). Never copy from aggregator sites.
3. **Eligibility criteria**: build rules without code — choose an applicant field, operator and value; set
   severity (*absolute* cannot be waived), whether it counts toward the verdict, whether it's fixable, custom
   explanations, recommended action and source reference. Use *groups* for "any one of" (OR) conditions and
   *custom questions* for scholarship-specific requirements. **Run preview** tests unsaved rules against a sample
   profile. Saving re-runs every applicant's current assessment for this scholarship.
4. **Required documents**, **Milestone template** (optional; defaults apply), **Essay rubric** (used to steer
   AI critique), **Supporting files** (e.g. a PDF of the official call).
5. **Publish**. Publishing is blocked until: a verified source, last-verified date, a future deadline, an
   application URL, valid criteria and at least one required document exist.
- Editing the deadline recalculates every open applicant's plan and notifies them.
- **Deactivate** hides it from applicants; existing applications and full revision history are preserved.
  Published scholarships whose deadline passes become *Expired* automatically.

## Window status & the partner dataset
Each scholarship has a **window status** (Open, Opens soon, Not announced, Closed, Paused), a *current window*
and a *next window* description, a group (UG/PG, in/outside Africa), key eligibility and how-to-apply text.
Published scholarships stay visible between rounds so applicants can prepare; applications and plans can only
be started while the window is Open or Opens soon. When an open window's deadline passes, a daily job marks it
Closed — update the next window and reopen it when the new call is announced.

The 35 Mastercard Foundation partner opportunities (research snapshot of 24 Nov 2026) are loaded with
`npm run db:import-scholarships`. Their official links are institution homepages — please replace them with the
exact MCF page and application links from your research table (Scholarships → open one → Sources & Details), and
re-verify each record. Re-running the import overwrites those records with the dataset, so edit
`src/lib/data/mcf-scholarships.ts` instead if you want to re-import.

## Applicants & applications
- **Applicants**: search/filter by registration date, completion, status, scholarship, verdict, reviewer,
  deadline; paginate; **Export CSV** (sensitive columns require the *exports.sensitive* permission).
  Viewing a record is audit-logged; sensitive fields show "[restricted]" without permission.
- **Applications**: filter unassigned, open one to **assign reviewers** (they're notified) or **change status**
  (only valid transitions are offered; screening overrides require a reason; outcomes are timestamped).

## Reviews
- **Document reviews / Essay reviews** list items waiting for review with applicant, scholarship, version,
  status and assigned reviewer. Open one to comment (select text to anchor a comment), decide, or complete.
- **AI approval queue**: every AI critique waits here. Edit any field, then **Approve & publish**, **Reject**
  (reason required — never shown to the applicant), or **Request additional review**.

## Notifications
Monitor every email/SMS/in-app message with status, attempts, provider responses and idempotency key.
Failed messages (after automatic retries at 5, 15, 60 minutes) can be **retried**; pending ones **cancelled**.
**Edit templates** with `{{variables}}`.

## Content, analytics, users, privacy, audit, settings
- **Content & resources**: articles, guides, FAQs, videos, downloads, webinars, announcements; draft/publish/
  archive; public or members-only; categories and tags; contact-form inbox.
- **Analytics & reports**: filter by date, scholarship, institution, status and registration cohort; CSV export.
- **Users & roles**: grant/revoke roles, suspend/reactivate. Super admins edit the role-permission matrix.
- **Privacy requests**: process deletion requests within 30 days (erase/anonymise or reject with notes).
- **Audit logs**: read-only, searchable; cannot be altered by anyone.
- **Settings**: brand/contact, upload limits and file types, reminder offsets, referee link validity, SMS/AI
  switches, registration, maintenance banner, legal text; integration status; run background jobs manually.

## Learning resources, application guide and FAQ

- **Sample documents** (SOP sample, ALU CV template, recommendation letter sample) are loaded with
  `npm run db:import-resources`. The files live in `public/downloads/` (previews in `public/downloads/previews/`), and the
  explanation for each is in `src/lib/data/learning-resources.ts`. They appear in **Admin → Content** like any other resource and
  can be edited there; re-running the import overwrites those edits with the dataset. To add another file, put it in
  `public/downloads/` and set the resource's external link to `/downloads/<file>`: the resource page then shows a download card.
- **The application guide** (`/guide`) is the written version of the "Scholarship Access Code" webinar. The slides themselves are
  not published. Edit it in `src/app/(public)/guide/page.tsx`.
- **The FAQ** (`/faq`) is in `src/lib/data/faq.ts`. Items marked `home: true` also appear on the home page.

## School logos

Cards and scholarship pages show each school's logo, or a coloured initials badge when there is none.

- `npm run logos:fetch` downloads logos from the schools' official websites (run it on a machine with internet access,
  then commit `public/logos/` and `src/lib/data/school-logos.json`). It prints which schools worked and which failed.
- For a school that failed, or to use a better image, save a square PNG as `public/logos/<hostname>.png`
  (e.g. `public/logos/www.ashesi.edu.gh.png`) and run `npm run logos:fetch` again: existing files are kept.
- In **Admin → Scholarships → Edit** you can set the **School logo** field to any `https://` image or `/logos/` file.
  A logo set there by hand is never overwritten by the fetch or import scripts.
- Logos belong to their institutions; SOAR Hub shows them only to identify the school next to its listing.
