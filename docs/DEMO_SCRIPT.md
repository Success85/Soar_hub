# SOAR Hub: full demo script (applicant A–Z, then admin A–Z)

Every step in this script was run end to end in a browser against the real ALU listing. The same flows are covered by
the automated tests in `tests/e2e/` (`applicant-journey`, `demo-admin-followup`, `admin`, `reviewer`).

Plan about **35–45 minutes**: 5 for setup, 5 for the public site, 15 for the applicant, and 15 for the admin and reviewer.

---

## 0. One-time setup

From the project folder:

```bash
git pull
npm install
npm run demo:setup
npm run dev
```

`demo:setup` applies migrations and creates the demo accounts. It also loads the 35 partner scholarships (archiving the
`[Demo]` placeholders) and the learning resources. It is safe to run again.

Open <http://localhost:3000>.

**Demo accounts** (password `Soar-demo-2026!`, unless you set `DEMO_PASSWORD` in `.env`):

| Role | Email | Use it for |
|---|---|---|
| Admin | `admin@demo.soarhub.ng` | Admin dashboard (part 3) |
| Reviewer | `reviewer@demo.soarhub.ng` | Reviewing documents and essays (part 4) |
| Super admin | `superadmin@demo.soarhub.ng` | Users and roles |
| Applicant | `
` | A pre-filled applicant (optional) |

In part 2 you create a **new** applicant live, so the audience sees sign-up from the very start.

**Emails in demo mode.** Nothing is really sent. Every email SOAR Hub would send appears at
**<http://localhost:3000/dev/mailbox>**, with clickable links. Opening the page also sends anything queued, so the
background worker doesn't need to run. This page only exists in development.

**Have ready:** two or three small PDF or JPG files (any document will do). Use **two browser windows**: a normal one
for the applicant and a private/incognito one for the admin and reviewer, so both stay signed in.

---

## 1. Public site (visitor), about 5 minutes

1. **Home page.** Walk through the purpose, who it's for, and the FAQ at the bottom.
2. **Scholarships** (top menu):
   - The counters (Open now, Opening soon, closing within 30 days) and the status tabs (Open, Opens soon, Not announced,
     Closed).
   - The groups: Undergraduate in Africa, outside Africa, and Postgraduate.
   - The filters (group, level, country, search) and the **Cards / Table** switch.
3. Open **African Leadership University (ALU)**:
   - At a glance, current and next window, key eligibility and the eligibility checklist.
   - **Application documents**, split into *Admission application* (9) and *Scholarship application* (6), with the
     "Visit the official page" note.
4. **How to apply:** the full guide (ACCESS code, essay word budgets, video tips, documents, 24-hour action plan).
5. **Learning resources.** Open *Statement of purpose (SOP): a sample, explained* and show the download card and the
   explanation.
6. **FAQ:** open a couple of questions, for example "Is there an age limit?" and "Which documents do I need…".

---

## 2. Applicant A–Z, about 15 minutes (normal browser window)

### 2.1 Sign up and verify
1. **Get started** → fill in First name `Amina`, Last name `Bello`, an email you haven't used before (e.g.
   `amina.demo1@example.com`) and a password (e.g. `Bright-future-2026`). Tick both consent boxes → **Create account**.
2. The "Check your inbox" page appears. Click **Open the development mailbox** → click the `/verify-email?token=…` link
   → **Email verified** → **Continue**.
3. Point out that protected pages stay locked until the email is verified.

### 2.2 Onboarding (profile, about 2 minutes)
**Start my profile**, then fill in each step and **Save and continue**:
- **Personal:** date of birth `2006-08-15`, citizenship `Nigeria`, residence `Nigeria`, state of origin `Kaduna`.
- **Education:** level *Completed secondary school*, school name, graduation year `2025`, credit passes `6`, tick
  *WASSCE (WAEC)*.
- **Background:** first in family *Yes*, needs financial support *Yes* (explain that sensitive questions are optional).
- **Goals:** "What would you like to study?" `Software Engineering`.
- **Consent:** tick the data-processing consent → **Finish and go to my dashboard**.

### 2.3 Find a scholarship and check eligibility
1. **Dashboard** → **Scholarships** → **African Leadership University (ALU)** → **☆ Save scholarship**.
2. **Check my eligibility** → **Run eligibility check** → result: **Likely eligible**, shown criterion by criterion
   (African citizenship ✓, completed secondary school ✓).
   - Optional: on the **Profile** page change *Country of citizenship* to `United Kingdom`, run the check again to show
     **Not eligible** (African citizenship is an absolute rule for ALU), then change it back to `Nigeria`.

### 2.4 Application plan and checklist
1. **Start application plan.** The application page opens:
   - The **Required document checklist**, grouped *Admission application · 0/9 ready* and *Scholarship application ·
     0/6 ready*.
   - The plan of tasks, scheduled backward from the 30 Nov deadline.
2. **Start preparing.**
3. Upload two or three documents. Click **Upload** next to *Grade 10–12 results* → choose a file → **Upload document**.
   Come back and the counter goes up. Repeat for *International passport*, and so on.
   - Show the file check: a renamed non-PDF is rejected ("couldn't recognise this file").
4. For **Recommendation letter 2**, show both options: **Request from a referee** and **Upload a letter I already have**.

### 2.5 Referee (no account needed)
1. **Referees** → choose the ALU application → name `Mr Ibrahim Yusuf`, email `referee.demo1@example.com`,
   relationship `Teacher`, a date two weeks ahead → **Send secure request**.
2. Open **/dev/mailbox** → filter by the referee's email → click the `/referee/…` link. Ideally use a third window;
   the referee doesn't sign in.
3. The referee sees the applicant's name, uploads a PDF, ticks the confirmation → **Submit reference letter**. Open the
   link again and it can't be reused.
4. Back as Amina: **Referees** shows *Submitted*, and the letter is now in the checklist's *Recommendation letter 1*
   slot. The bell shows "Reference letter received".

### 2.6 Essay and review request
1. **Essays & answer bank** → **New essay** → title `ALU scholarship essay`, prompt
   `Describe a time you showed leadership`, and a few sentences → **Create essay** → **Submit version 1 for review**.
2. Open one of the uploaded documents → **Request review**.

### 2.7 Planner
**Application planner**: the list, calendar and timeline views. Tick a task with **Mark complete**.

> **Submitting.** **Mark application as submitted** unlocks only when every *required* document is ready and every
> required task is done. To show it live, upload the remaining documents (about 5 minutes; the same small file is fine)
> and complete the tasks. Then enter a confirmation number (e.g. `APP-2026-001`) → **Mark application as submitted** →
> progress shows **100%**. If time is short, explain the lock and move on: the admin part works either way.

---

## 3. Admin A–Z, about 10 minutes (private window)

Sign in as `admin@demo.soarhub.ng`.

1. **Overview:** totals, applications by status, deadlines coming up.
2. **Applicants:** find *Amina Bello* → profile completion, profile details. Show **Export CSV**.
3. **Applications** → open Amina's ALU application:
   - The progress and checklist (optional items are marked *optional*, not *missing*) and the status history.
   - **Reviewers** → choose *Halima Musa* → **Assign** ("Reviewer assigned").
4. **Scholarships** → open **ALU**:
   - **Details:** window status, current and next window, key eligibility, and the **School logo** field.
   - **Eligibility criteria:** the rules builder → **Run preview** → **Validate & save criteria**.
   - **Required documents:** the Stage column (Admission or Scholarship) → **Save required documents**.
   - **Sources & verification:** official link → **Mark source verified**.
   - **Milestone template** and **Essay rubric:** what drives the applicant's plan and the reviewers' scoring.
   - **History:** every change is versioned.
   - Optional: **Scholarships → New scholarship**: create a draft, add a source, verify, **Publish**, then show it on the
     public list.
5. **Eligibility rules:** the shared rule library.
6. **Content & resources:** the three sample documents. Open one to show editing; publishing makes it public.
7. **Notifications** and **Notification templates:** the outbox and the editable email texts.
8. **Analytics**, then **Audit log** (filter e.g. `scholarship` or `application`): append-only, nobody can edit it.
9. **Settings:** integrations status and **run jobs** by hand, e.g. `scholarship-expiry` (closes windows whose deadline
   has passed) and `dispatch-notifications`.
10. With the super admin account: **Users → Roles** shows role and permission management.

---

## 4. Reviewer, about 5 minutes (private window: sign out, then sign in as `reviewer@demo.soarhub.ng`)

1. The **reviewer dashboard** lists Amina's application (assigned in step 3.3).
2. **Documents queue** → open the document Amina sent for review → **Start review** → add a comment → decision
   *Needs revision* with a short summary → **Record decision**.
3. **Essays queue** → open Amina's essay → paste a phrase into *Highlighted passage* → comment → **Add anchored
   comment** → outcome *Revision requested* → **Complete review**.
4. Back in the **applicant window**, refresh the essay: the highlighted passage and the comment are shown. Click **Mark
   revision completed**. The document shows *Needs revision* with the reviewer's summary.

AI critique is switched off unless `AI_PROVIDER` and `AI_API_KEY` are set in `.env`. When it's on, AI suggestions go to
the **AI approval queue** and an applicant sees them only after a reviewer approves them.

---

## 5. Finish: after submission (admin window)

Use this once Amina's application is **Submitted** (see the note in 2.7):

1. **Admin → Applications** → filter *Submitted* → open Amina's application.
2. **Change status** → *Shortlisted* → **Update status**.
3. **Change status** → *Outcome* → choose the outcome (e.g. *Awarded*) and add a note → **Update status**.
4. The **status history** shows Submitted → Shortlisted → Outcome recorded, and the applicant sees the update on their
   application page.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Something went wrong" on every page | PostgreSQL isn't running, or `.env` → `DATABASE_URL` is wrong (see README → Local setup). |
| No verification email | Open **/dev/mailbox** (it also sends queued emails). Check `.env` has `EMAIL_PROVIDER=console`. |
| "This email is already registered" | Use a new email (`amina.demo2@example.com`, …) for each run. |
| Sign-in blocked after many tries | Rate limiting: wait 15 minutes, or add `DISABLE_RATE_LIMIT=true` to `.env` for local demos only. |
| ALU says "Closed" | Its deadline (30 Nov 2026) has passed. Demo with another listing under the **Open** tab, or reopen ALU in **Admin → Scholarships** with a new deadline. |
| Signed out in the middle of the demo | Sessions end after 30 minutes idle (`SESSION_IDLE_MINUTES` in `.env`). |
